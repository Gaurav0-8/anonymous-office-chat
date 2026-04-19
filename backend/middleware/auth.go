package middleware

import (
	"os"
	"strings"

	"github.com/gaurav/chat-app/db"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Claims holds JWT payload fields
type Claims struct {
	UserID      int    `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

// AuthRequired validates the Bearer JWT token and sets user info in context locals
func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "Missing authorization header")
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid authorization header format")
		}

		tokenStr := parts[1]
		claims, err := ParseToken(tokenStr)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid or expired token")
		}

		// Set user info into context for downstream handlers
		c.Locals("user_id", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("display_name", claims.DisplayName)
		c.Locals("role", claims.Role)

		// VITAL: Verify user actually exists in the current database
		// This forces logout for users with old tokens after a database wipe.
		var dbID int
		err = db.DB.QueryRow("SELECT user_id FROM users WHERE user_id = ?", claims.UserID).Scan(&dbID)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "User session invalid. Please log in again.")
		}

		return c.Next()
	}
}

// ParseToken validates a token string and returns claims
func ParseToken(tokenStr string) (*Claims, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		secretKey = "change-this-super-secret-key-in-production"
	}

	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "Unexpected signing method")
		}
		return []byte(secretKey), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "Invalid token claims")
	}
	return claims, nil
}

// GetCurrentUser is a helper to extract user info from context locals
func GetCurrentUser(c *fiber.Ctx) (int, string, string, string) {
	userID := c.Locals("user_id").(int)
	username := c.Locals("username").(string)
	displayName := c.Locals("display_name").(string)
	role := c.Locals("role").(string)
	return userID, username, displayName, role
}
