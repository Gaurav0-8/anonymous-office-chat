package handlers

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
)

const (
	jwtExpireMinutes = 60
)

func SetupAuthRoutes(app *fiber.App) {
	auth := app.Group("/auth")
	auth.Post("/register", register)
	auth.Post("/login", login)
	auth.Get("/check-username/:username", checkUsername)
	auth.Get("/display-names", getDisplayNames)
}

func register(c *fiber.Ctx) error {
	var req struct {
		Username        string `json:"username"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirm_password"`
		DisplayName     string `json:"display_name"`
	}
	if err := c.BodyParser(&req); err != nil { return err }

	if req.Username == "" || req.Password == "" || req.DisplayName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Required fields missing")
	}
	if req.Password != req.ConfirmPassword {
		return fiber.NewError(fiber.StatusBadRequest, "Passwords mismatch")
	}
	if !IsValidDisplayName(req.DisplayName) {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid display name")
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)

	res, err := db.DB.Exec(
		"INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'user')",
		req.Username, string(hash), req.DisplayName,
	)
	if err != nil { return err }

	userID, _ := res.LastInsertId()
	db.DB.Exec("INSERT OR IGNORE INTO chat_participants (chat_id, user_id) VALUES (1, ?)", userID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"user_id": userID, "display_name": req.DisplayName})
}

func login(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil { return err }

	var userID int
	var passwordHash, displayName, role string
	err := db.DB.QueryRow(
		"SELECT user_id, password_hash, display_name, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&userID, &passwordHash, &displayName, &role)
	if err != nil { return fiber.NewError(fiber.StatusUnauthorized, "Invalid credentials") }

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid credentials")
	}

	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?", userID)

	token, err := createJWT(userID, req.Username, displayName, role)
	if err != nil { return err }

	return c.JSON(fiber.Map{
		"access_token": token,
		"token_type":   "bearer",
		"user": fiber.Map{"user_id": userID, "display_name": displayName},
	})
}

func checkUsername(c *fiber.Ctx) error {
	username := c.Params("username")
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	return c.JSON(fiber.Map{"available": count == 0})
}

func getDisplayNames(c *fiber.Ctx) error {
	rows, err := db.DB.Query("SELECT display_name FROM users")
	if err != nil { return c.JSON(fiber.Map{"display_names": DisplayNames}) }
	defer rows.Close()

	taken := map[string]bool{}
	for rows.Next() {
		var name string
		rows.Scan(&name); taken[name] = true
	}

	available := []string{}
	for _, name := range DisplayNames {
		if !taken[name] { available = append(available, name) }
	}
	return c.JSON(fiber.Map{"display_names": available})
}

func createJWT(userID int, username, displayName, role string) (string, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" { secretKey = "change-this-in-production" }

	claims := mw.Claims{
		UserID:      userID,
		Username:    username,
		DisplayName: displayName,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(60 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secretKey))
}
