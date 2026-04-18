package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
)

// SetupAdminRoutes registers all /admin routes (admin role required)
func SetupAdminRoutes(app *fiber.App) {
	admin := app.Group("/admin", mw.AuthRequired(), adminOnly())
	admin.Post("/mute/:user_id", muteUser)
	admin.Post("/unmute/:user_id", unmuteUser)
	admin.Post("/ban/:user_id", banUser)
	admin.Post("/unban/:user_id", unbanUser)
	admin.Get("/users", listUsers)
}

// adminOnly middleware ensures only users with role='admin' can access
func adminOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		_, _, _, role := mw.GetCurrentUser(c)
		if role != "admin" {
			return fiber.NewError(fiber.StatusForbidden, "Admin access required")
		}
		return c.Next()
	}
}

// POST /admin/mute/:user_id — mute a user in main group chat with expiry time
func muteUser(c *fiber.Ctx) error {
	targetUserID, err := c.ParamsInt("user_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid user_id")
	}

	var req struct {
		MutedUntil string `json:"muted_until"` // ISO 8601: "2024-01-01T15:00:00Z"
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	muteTime, err := time.Parse(time.RFC3339, req.MutedUntil)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid muted_until format. Use ISO 8601: 2024-01-01T15:00:00Z")
	}

	res, err := db.DB.Exec(
		"UPDATE chat_participants SET muted_until = ? WHERE chat_id = 1 AND user_id = ?",
		muteTime, targetUserID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "User not found in main chat")
	}

	return c.JSON(fiber.Map{
		"status":      "muted",
		"user_id":     targetUserID,
		"muted_until": muteTime,
	})
}

// POST /admin/unmute/:user_id — clear mute on a user
func unmuteUser(c *fiber.Ctx) error {
	targetUserID, err := c.ParamsInt("user_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid user_id")
	}

	db.DB.Exec(
		"UPDATE chat_participants SET muted_until = NULL WHERE chat_id = 1 AND user_id = ?",
		targetUserID,
	)
	return c.JSON(fiber.Map{"status": "unmuted", "user_id": targetUserID})
}

// POST /admin/ban/:user_id — ban a user from main group chat
func banUser(c *fiber.Ctx) error {
	targetUserID, err := c.ParamsInt("user_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid user_id")
	}

	res, err := db.DB.Exec(
		"UPDATE chat_participants SET is_banned = 1 WHERE chat_id = 1 AND user_id = ?",
		targetUserID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "User not found in main chat")
	}

	return c.JSON(fiber.Map{"status": "banned", "user_id": targetUserID})
}

// POST /admin/unban/:user_id — unban a user from main group chat
func unbanUser(c *fiber.Ctx) error {
	targetUserID, err := c.ParamsInt("user_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid user_id")
	}

	db.DB.Exec(
		"UPDATE chat_participants SET is_banned = 0 WHERE chat_id = 1 AND user_id = ?",
		targetUserID,
	)
	return c.JSON(fiber.Map{"status": "unbanned", "user_id": targetUserID})
}

// GET /admin/users — list all registered users
func listUsers(c *fiber.Ctx) error {
	rows, err := db.DB.Query(
		"SELECT user_id, username, display_name, role, last_seen, created_at FROM users ORDER BY created_at DESC",
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	users := []fiber.Map{}
	for rows.Next() {
		var uid int
		var username, displayName, role string
		var lastSeen, createdAt time.Time
		rows.Scan(&uid, &username, &displayName, &role, &lastSeen, &createdAt)
		users = append(users, fiber.Map{
			"user_id":      uid,
			"username":     username,
			"display_name": displayName,
			"role":         role,
			"last_seen":    lastSeen,
			"created_at":   createdAt,
		})
	}
	return c.JSON(users)
}
