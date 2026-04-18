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

// SetupAuthRoutes registers all /auth routes
func SetupAuthRoutes(app *fiber.App) {
	auth := app.Group("/auth")
	auth.Post("/register", register)
	auth.Post("/login", login)
	auth.Get("/check-username/:username", checkUsername)
	auth.Get("/display-names", getDisplayNames)
}

// POST /auth/register
func register(c *fiber.Ctx) error {
	var req struct {
		Username        string `json:"username"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirm_password"`
		DisplayName     string `json:"display_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	if req.Username == "" || req.Password == "" || req.DisplayName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "username, password, and display_name are required")
	}
	if req.Password != req.ConfirmPassword {
		return fiber.NewError(fiber.StatusBadRequest, "Passwords do not match")
	}
	if !IsValidDisplayName(req.DisplayName) {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid display_name. Must be from predefined list.")
	}

	// Check username uniqueness
	var existing int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", req.Username).Scan(&existing)
	if existing > 0 {
		return fiber.NewError(fiber.StatusBadRequest, "Username already exists")
	}

	// Check display_name uniqueness
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE display_name = ?", req.DisplayName).Scan(&existing)
	if existing > 0 {
		return fiber.NewError(fiber.StatusBadRequest, "Display name already taken. Please choose another one.")
	}

	// Hash password with bcrypt cost=10
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to hash password")
	}

	// Insert user
	res, err := db.DB.Exec(
		"INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'user')",
		req.Username, string(hash), req.DisplayName,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error during registration")
	}

	userID, _ := res.LastInsertId()

	// Auto-add to Main_Group_Chat (chat_id=1)
	db.DB.Exec(
		"INSERT OR IGNORE INTO chat_participants (chat_id, user_id) VALUES (1, ?)",
		userID,
	)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":      "User registered successfully",
		"user_id":      userID,
		"username":     req.Username,
		"display_name": req.DisplayName,
	})
}

// POST /auth/login
func login(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	var userID int
	var passwordHash, displayName, role string
	err := db.DB.QueryRow(
		"SELECT user_id, password_hash, display_name, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&userID, &passwordHash, &displayName, &role)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid username or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid username or password")
	}

	// Update last_seen
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?", userID)

	token, err := createJWT(userID, req.Username, displayName, role)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create token")
	}

	return c.JSON(fiber.Map{
		"access_token": token,
		"token_type":   "bearer",
		"user": fiber.Map{
			"user_id":      userID,
			"username":     req.Username,
			"display_name": displayName,
			"role":         role,
		},
	})
}

// GET /auth/check-username/:username
func checkUsername(c *fiber.Ctx) error {
	username := c.Params("username")
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", username).Scan(&count)
	return c.JSON(fiber.Map{"available": count == 0})
}

// GET /auth/display-names — returns available (not yet taken) display names
func getDisplayNames(c *fiber.Ctx) error {
	rows, err := db.DB.Query("SELECT display_name FROM users")
	if err != nil {
		return c.JSON(fiber.Map{
			"display_names":   DisplayNames,
			"total_available": len(DisplayNames),
			"total_taken":     0,
		})
	}
	defer rows.Close()

	taken := map[string]bool{}
	for rows.Next() {
		var name string
		rows.Scan(&name)
		taken[name] = true
	}

	available := []string{}
	for _, name := range DisplayNames {
		if !taken[name] {
			available = append(available, name)
		}
	}

	return c.JSON(fiber.Map{
		"display_names":   available,
		"total_available": len(available),
		"total_taken":     len(taken),
	})
}

// createJWT builds a signed HS256 JWT token
func createJWT(userID int, username, displayName, role string) (string, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		secretKey = "change-this-super-secret-key-in-production"
	}

	claims := mw.Claims{
		UserID:      userID,
		Username:    username,
		DisplayName: displayName,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtExpireMinutes * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secretKey))
}

// IsValidDisplayName is exposed for use in this package
func IsValidDisplayName(name string) bool {
	for _, n := range DisplayNames {
		if n == name {
			return true
		}
	}
	return false
}
