package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
	"github.com/gaurav/chat-app/ws"
)

// SetupMessageRoutes registers all /messages routes
func SetupMessageRoutes(app *fiber.App) {
	msgs := app.Group("/messages", mw.AuthRequired())
	msgs.Post("", createMessage)
	msgs.Patch("/:message_id/edit", editMessage)
	msgs.Patch("/:message_id/delete", deleteMessage)
	msgs.Get("/:message_id/readers", getMessageReaders)
	msgs.Post("/:message_id/read", markMessageRead)
}

// POST /messages — send a new text message
func createMessage(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)

	var req struct {
		ChatID      int    `json:"chat_id"`
		MessageText string `json:"message_text"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if req.MessageText == "" {
		return fiber.NewError(fiber.StatusBadRequest, "message_text is required")
	}

	// Check if user is muted in this chat
	var mutedUntil *time.Time
	var isBanned int
	row := db.DB.QueryRow(
		"SELECT is_banned, muted_until FROM chat_participants WHERE chat_id = ? AND user_id = ?",
		req.ChatID, userID,
	)
	var mu *string
	row.Scan(&isBanned, &mu)
	if isBanned == 1 {
		return fiber.NewError(fiber.StatusForbidden, "You are banned from this chat")
	}
	if mu != nil {
		t, _ := time.Parse("2006-01-02T15:04:05Z", *mu)
		mutedUntil = &t
		if mutedUntil.After(time.Now()) {
			return fiber.NewError(fiber.StatusForbidden, "You are muted in this chat")
		}
	}

	res, err := db.DB.Exec(
		"INSERT INTO messages (chat_id, sender_id, message_text) VALUES (?, ?, ?)",
		req.ChatID, userID, req.MessageText,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create message")
	}
	messageID, _ := res.LastInsertId()

	// Fetch participants to broadcast
	pRows, _ := db.DB.Query(
		"SELECT user_id FROM chat_participants WHERE chat_id = ?", req.ChatID,
	)
	defer pRows.Close()
	var participantIDs []int
	for pRows.Next() {
		var pid int
		pRows.Scan(&pid)
		participantIDs = append(participantIDs, pid)
	}

	sentAt := time.Now()
	// Broadcast via WebSocket
	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "new_message",
		"message": fiber.Map{
			"message_id":   messageID,
			"chat_id":      req.ChatID,
			"sender_id":    userID,
			"sender_name":  displayName,
			"message_text": req.MessageText,
			"sent_at":      sentAt,
			"is_edited":    false,
			"image_file_id": nil,
		},
	}, participantIDs)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message_id":   messageID,
		"chat_id":      req.ChatID,
		"sender_id":    userID,
		"message_text": req.MessageText,
		"sent_at":      sentAt,
	})
}

// PATCH /messages/:message_id/edit — edit own message
func editMessage(c *fiber.Ctx) error {
	msgID, err := c.ParamsInt("message_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid message_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	var req struct {
		MessageText string `json:"message_text"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	res, err := db.DB.Exec(`
		UPDATE messages SET message_text = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP
		WHERE message_id = ? AND sender_id = ?
	`, req.MessageText, msgID, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Message not found or not yours")
	}

	editedAt := time.Now()
	return c.JSON(fiber.Map{
		"message_id":   msgID,
		"message_text": req.MessageText,
		"is_edited":    true,
		"edited_at":    editedAt,
	})
}

// PATCH /messages/:message_id/delete — soft-delete own message
func deleteMessage(c *fiber.Ctx) error {
	msgID, err := c.ParamsInt("message_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid message_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	res, err := db.DB.Exec(`
		UPDATE messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
		WHERE message_id = ? AND sender_id = ?
	`, msgID, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Message not found or not yours")
	}

	return c.JSON(fiber.Map{
		"message_id": msgID,
		"is_deleted": true,
		"deleted_at": time.Now(),
	})
}

// GET /messages/:message_id/readers — who has read a message
func getMessageReaders(c *fiber.Ctx) error {
	msgID, err := c.ParamsInt("message_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid message_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Get chat_id for this message
	var chatID int
	err = db.DB.QueryRow("SELECT chat_id FROM messages WHERE message_id = ?", msgID).Scan(&chatID)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Message not found")
	}

	// Verify user is participant
	var count int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?", chatID, userID,
	).Scan(&count)
	if count == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not authorized")
	}

	rows, _ := db.DB.Query(`
		SELECT u.display_name, mr.read_at FROM message_reads mr
		INNER JOIN users u ON mr.user_id = u.user_id
		WHERE mr.message_id = ?
		ORDER BY mr.read_at DESC
	`, msgID)
	defer rows.Close()

	readers := []fiber.Map{}
	for rows.Next() {
		var displayName string
		var readAt time.Time
		rows.Scan(&displayName, &readAt)
		readers = append(readers, fiber.Map{
			"display_name": displayName,
			"read_at":      readAt,
		})
	}
	return c.JSON(readers)
}

// POST /messages/:message_id/read — mark message as read by current user
func markMessageRead(c *fiber.Ctx) error {
	msgID, err := c.ParamsInt("message_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid message_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	db.DB.Exec(
		"INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)",
		msgID, userID,
	)
	return c.JSON(fiber.Map{"status": "ok"})
}
