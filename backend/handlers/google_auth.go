package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"google.golang.org/api/idtoken"

	"github.com/gaurav/chat-app/db"
	"github.com/gaurav/chat-app/middleware"
	"github.com/gaurav/chat-app/models"
)

// SetupGoogleAuthRoutes registers Google OAuth related routes
func SetupGoogleAuthRoutes(app *fiber.App) {
	app.Post("/auth/google", googleLogin)
	app.Post("/auth/set-name", middleware.AuthRequired(), setDisplayName)
}

// POST /auth/google
func googleLogin(c *fiber.Ctx) error {
	var req struct {
		IDToken string `json:"id_token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Missing id_token")
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		return fiber.NewError(fiber.StatusInternalServerError, "Google Client ID not configured on server")
	}

	// 1. Verify Google ID Token
	payload, err := idtoken.Validate(context.Background(), req.IDToken, clientID)
	if err != nil {
		log.Printf("[GoogleAuth] Token validation failed: %v", err)
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid Google token")
	}

	googleID := payload.Subject
	email, _ := payload.Claims["email"].(string)
	
	if email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Google account must have an email")
	}

	// 2. Check if user already exists
	var user models.User
	err = db.DB.QueryRow(
		"SELECT user_id, username, email, display_name, role FROM users WHERE google_id = ?",
		googleID,
	).Scan(&user.UserID, &user.Username, &user.Email, &user.DisplayName, &user.Role)

	isNewUser := false
	if err == sql.ErrNoRows {
		isNewUser = true
		// 3. New User Registration
		user.GoogleID = googleID
		user.Email = email
		user.Role = "user"
		
		// Derive username from email (e.g. gaurav@gmail.com -> gaurav)
		user.Username = strings.Split(email, "@")[0]
		
		// Ensure username is unique (append random tag if needed)
		var count int
		db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", user.Username).Scan(&count)
		if count > 0 {
			user.Username = fmt.Sprintf("%s_%s", user.Username, googleID[:5])
		}

		// Assign a random anonymous display name
		user.DisplayName = getRandomAvailableDisplayName()
		if user.DisplayName == "" {
			return fiber.NewError(fiber.StatusInternalServerError, "No more anonymous names available")
		}

		// Insert into DB
		res, err := db.DB.Exec(
			"INSERT INTO users (google_id, email, username, display_name, role) VALUES (?, ?, ?, ?, ?)",
			googleID, email, user.Username, user.DisplayName, user.Role,
		)
		if err != nil {
			log.Printf("[GoogleAuth] Database insertion failed: %v", err)
			return fiber.NewError(fiber.StatusInternalServerError, "Failed to create user profile")
		}
		
		id, _ := res.LastInsertId()
		user.UserID = int(id)

		// Auto-add to Main Chat
		db.DB.Exec("INSERT OR IGNORE INTO chat_participants (chat_id, user_id) VALUES (1, ?)", user.UserID)
		
		log.Printf("[GoogleAuth] New user registered: %s (%s)", user.Email, user.DisplayName)
	} else if err != nil {
		log.Printf("[GoogleAuth] Database query failed: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}

	// 4. Update last seen
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?", user.UserID)

	// 5. Create JWT Token
	token, err := createJWT(user.UserID, user.Username, user.DisplayName, user.Role)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create access token")
	}

	return c.JSON(fiber.Map{
		"access_token": token,
		"token_type":   "bearer",
		"is_new_user":  isNewUser,
		"user": fiber.Map{
			"user_id":      user.UserID,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         user.Role,
		},
	})
}

// Helper to get a random display name that hasn't been taken
func getRandomAvailableDisplayName() string {
	rows, err := db.DB.Query("SELECT display_name FROM users")
	if err != nil {
		return ""
	}
	defer rows.Close()

	taken := map[string]bool{}
	for rows.Next() {
		var name string
		rows.Scan(&name)
		taken[name] = true
	}

	// Shuffle or just pick first available from our list
	for _, name := range DisplayNames {
		if !taken[name] {
			return name
		}
	}
	return ""
}

// POST /auth/set-name
func setDisplayName(c *fiber.Ctx) error {
	var req struct {
		DisplayName string `json:"display_name"`
	}
	if err := c.BodyParser(&req); err != nil || req.DisplayName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid display name")
	}

	userID := c.Locals("user_id").(int)

	// Check if name is taken
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE display_name = ?", req.DisplayName).Scan(&count)
	if count > 0 {
		return fiber.NewError(fiber.StatusConflict, "This name is already taken by someone else")
	}

	// Update name
	_, err := db.DB.Exec("UPDATE users SET display_name = ? WHERE user_id = ?", req.DisplayName, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update display name")
	}

	return c.SendStatus(fiber.StatusOK)
}
