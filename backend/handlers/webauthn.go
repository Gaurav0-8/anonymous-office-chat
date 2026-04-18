package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/gaurav/chat-app/db"
	wauthn "github.com/gaurav/chat-app/wauthn"
)

// ── WebAuthn User (implements webauthn.User interface) ────────────────────────

type WAUser struct {
	UserID      int
	Username    string
	DisplayName string
	Credentials []webauthn.Credential
}

func (u *WAUser) WebAuthnID() []byte                         { return []byte(fmt.Sprintf("%d", u.UserID)) }
func (u *WAUser) WebAuthnName() string                      { return u.Username }
func (u *WAUser) WebAuthnDisplayName() string               { return u.DisplayName }
func (u *WAUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }

// ── In-memory session store (challenges live for 5 minutes) ──────────────────

type waSession struct {
	data        webauthn.SessionData
	userID      int
	username    string
	displayName string
	role        string
	createdAt   time.Time
}

var (
	waSessions   = make(map[string]*waSession)
	waSessionsMu sync.Mutex
)

func init() {
	// Purge expired sessions every minute
	go func() {
		for range time.NewTicker(time.Minute).C {
			waSessionsMu.Lock()
			for k, v := range waSessions {
				if time.Since(v.createdAt) > 5*time.Minute {
					delete(waSessions, k)
				}
			}
			waSessionsMu.Unlock()
		}
	}()
}

func waStore(s *waSession) string {
	id := uuid.New().String()
	waSessionsMu.Lock()
	waSessions[id] = s
	waSessionsMu.Unlock()
	return id
}

func waGet(id string) (*waSession, bool) {
	waSessionsMu.Lock()
	defer waSessionsMu.Unlock()
	s, ok := waSessions[id]
	if !ok || time.Since(s.createdAt) > 5*time.Minute {
		delete(waSessions, id)
		return nil, false
	}
	return s, true
}

func waDel(id string) {
	waSessionsMu.Lock()
	delete(waSessions, id)
	waSessionsMu.Unlock()
}

// ── DB helpers ────────────────────────────────────────────────────────────────

func loadWAUser(userID int) (*WAUser, error) {
	var u WAUser
	err := db.DB.QueryRow(
		"SELECT user_id, username, display_name FROM users WHERE user_id = ?", userID,
	).Scan(&u.UserID, &u.Username, &u.DisplayName)
	if err != nil {
		return nil, err
	}

	rows, err := db.DB.Query(
		"SELECT credential_data FROM webauthn_credentials WHERE user_id = ?", userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var js string
		rows.Scan(&js)
		var cred webauthn.Credential
		if json.Unmarshal([]byte(js), &cred) == nil {
			u.Credentials = append(u.Credentials, cred)
		}
	}
	return &u, nil
}

// ── Route setup ───────────────────────────────────────────────────────────────

func SetupWebAuthnRoutes(app *fiber.App) {
	wn := app.Group("/auth/webauthn")
	wn.Post("/register/begin", waBeginRegistration)
	wn.Post("/register/finish", waFinishRegistration)
	wn.Post("/login/begin", waBeginLogin)
	wn.Post("/login/finish", waFinishLogin)

	// One-time hidden admin setup — URL not public, requires ADMIN_SETUP_TOKEN header
	adm := app.Group("/auth/admin-setup")
	adm.Post("/begin", waBeginAdminSetup)
	adm.Post("/finish", waFinishRegistration) // reuses same finish logic
}

// ── Registration ──────────────────────────────────────────────────────────────

// POST /auth/webauthn/register/begin
func waBeginRegistration(c *fiber.Ctx) error {
	var req struct {
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if len(req.Username) < 3 {
		return fiber.NewError(fiber.StatusBadRequest, "Username must be at least 3 characters")
	}
	if !IsValidDisplayName(req.DisplayName) {
		return fiber.NewError(fiber.StatusBadRequest, "Display name must be from the predefined list")
	}

	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", req.Username).Scan(&count)
	if count > 0 {
		return fiber.NewError(fiber.StatusConflict, "Username already taken")
	}
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE display_name = ?", req.DisplayName).Scan(&count)
	if count > 0 {
		return fiber.NewError(fiber.StatusConflict, "Display name already taken")
	}

	tempUser := &WAUser{UserID: -1, Username: req.Username, DisplayName: req.DisplayName}
	options, sessionData, err := wauthn.WA.BeginRegistration(tempUser)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("WebAuthn error: %v", err))
	}

	sessionID := waStore(&waSession{
		data: *sessionData, userID: -1,
		username: req.Username, displayName: req.DisplayName,
		role: "user", createdAt: time.Now(),
	})
	return c.JSON(fiber.Map{"session_id": sessionID, "options": options})
}

// POST /auth/webauthn/register/finish
func waFinishRegistration(c *fiber.Ctx) error {
	var req struct {
		SessionID  string          `json:"session_id"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	sess, ok := waGet(req.SessionID)
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "Session expired — please try again")
	}
	waDel(req.SessionID)

	ccr, err := protocol.ParseCredentialCreationResponseBody(bytes.NewReader(req.Credential))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Invalid credential: %v", err))
	}

	tempUser := &WAUser{UserID: -1, Username: sess.username, DisplayName: sess.displayName}
	credential, err := wauthn.WA.CreateCredential(tempUser, sess.data, ccr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Verification failed: %v", err))
	}

	// Prevent same device from creating multiple accounts
	var credCount int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM webauthn_credentials WHERE credential_id = ?",
		string(credential.ID),
	).Scan(&credCount)
	if credCount > 0 {
		return fiber.NewError(fiber.StatusConflict, "This device is already registered to another account")
	}

	// Create user
	res, err := db.DB.Exec(
		"INSERT INTO users (username, password_hash, display_name, role) VALUES (?, '', ?, ?)",
		sess.username, sess.displayName, sess.role,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create user")
	}
	userID, _ := res.LastInsertId()

	// Add to main group chat
	db.DB.Exec("INSERT OR IGNORE INTO chat_participants (chat_id, user_id) VALUES (1, ?)", userID)

	// Store WebAuthn credential
	credJSON, _ := json.Marshal(credential)
	db.DB.Exec(
		"INSERT INTO webauthn_credentials (user_id, credential_id, credential_data) VALUES (?, ?, ?)",
		userID, string(credential.ID), string(credJSON),
	)

	token, err := createJWT(int(userID), sess.username, sess.displayName, sess.role)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create token")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"access_token": token,
		"user": fiber.Map{
			"user_id":      userID,
			"username":     sess.username,
			"display_name": sess.displayName,
			"role":         sess.role,
		},
	})
}

// ── Login ─────────────────────────────────────────────────────────────────────

// POST /auth/webauthn/login/begin
func waBeginLogin(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	var userID int
	if err := db.DB.QueryRow(
		"SELECT user_id FROM users WHERE username = ?", req.Username,
	).Scan(&userID); err != nil {
		return fiber.NewError(fiber.StatusNotFound, "User not found")
	}

	user, err := loadWAUser(userID)
	if err != nil || len(user.Credentials) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "No Face ID registered for this account")
	}

	options, sessionData, err := wauthn.WA.BeginLogin(user)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("WebAuthn error: %v", err))
	}

	sessionID := waStore(&waSession{data: *sessionData, userID: userID, createdAt: time.Now()})
	return c.JSON(fiber.Map{"session_id": sessionID, "options": options})
}

// POST /auth/webauthn/login/finish
func waFinishLogin(c *fiber.Ctx) error {
	var req struct {
		SessionID  string          `json:"session_id"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	sess, ok := waGet(req.SessionID)
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "Session expired — please try again")
	}
	waDel(req.SessionID)

	user, err := loadWAUser(sess.userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to load user")
	}

	car, err := protocol.ParseCredentialRequestResponseBody(bytes.NewReader(req.Credential))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Invalid credential: %v", err))
	}

	credential, err := wauthn.WA.ValidateLogin(user, sess.data, car)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Face ID verification failed")
	}

	// Update sign count
	credJSON, _ := json.Marshal(credential)
	db.DB.Exec(
		"UPDATE webauthn_credentials SET credential_data = ? WHERE user_id = ? AND credential_id = ?",
		string(credJSON), user.UserID, string(credential.ID),
	)
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?", user.UserID)

	var role string
	db.DB.QueryRow("SELECT role FROM users WHERE user_id = ?", user.UserID).Scan(&role)

	token, err := createJWT(user.UserID, user.Username, user.DisplayName, role)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create token")
	}

	return c.JSON(fiber.Map{
		"access_token": token,
		"user": fiber.Map{
			"user_id":      user.UserID,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         role,
		},
	})
}

// ── Admin Setup (one-time, hidden URL) ───────────────────────────────────────

// POST /auth/admin-setup/begin
func waBeginAdminSetup(c *fiber.Ctx) error {
	// Verify secret token
	token := c.Get("X-Admin-Setup-Token")
	expected := os.Getenv("ADMIN_SETUP_TOKEN")
	if expected == "" || token != expected {
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid setup token")
	}

	// Only allow if no admin exists
	var adminCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
	if adminCount > 0 {
		return fiber.NewError(fiber.StatusConflict, "Admin already exists — use normal login")
	}

	var req struct {
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if len(req.Username) < 3 || req.DisplayName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "username and display_name are required")
	}

	// Check uniqueness
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", req.Username).Scan(&count)
	if count > 0 {
		return fiber.NewError(fiber.StatusConflict, "Username already taken")
	}

	tempUser := &WAUser{UserID: -999, Username: req.Username, DisplayName: req.DisplayName}
	options, sessionData, err := wauthn.WA.BeginRegistration(tempUser)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("WebAuthn error: %v", err))
	}

	sessionID := waStore(&waSession{
		data: *sessionData, userID: -1,
		username: req.Username, displayName: req.DisplayName,
		role: "admin", createdAt: time.Now(),
	})
	return c.JSON(fiber.Map{"session_id": sessionID, "options": options})
}
