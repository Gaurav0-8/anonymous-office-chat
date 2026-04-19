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
	msgs.Post("/:message_id/react", toggleReaction)
}

// POST /messages — send a new text message (now with reply support)
func createMessage(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)

	var req struct {
		ChatID          int    `json:"chat_id"`
		MessageText     string `json:"message_text"`
		ParentMessageID *int   `json:"parent_message_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if req.MessageText == "" {
		return fiber.NewError(fiber.StatusBadRequest, "message_text is required")
	}

	// Check if user is a participant in this chat
	var participates int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?",
		req.ChatID, userID,
	).Scan(&participates)
	if participates == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not a participant in this chat")
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
		"INSERT INTO messages (chat_id, sender_id, message_text, parent_message_id) VALUES (?, ?, ?, ?)",
		req.ChatID, userID, req.MessageText, req.ParentMessageID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create message")
	}
	messageID, _ := res.LastInsertId()

	// Broadcast via WebSocket
	sentAt := time.Now()
	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", req.ChatID)
	defer pRows.Close()
	var participantIDs []int
	for pRows.Next() {
		var pid int
		pRows.Scan(&pid)
		participantIDs = append(participantIDs, pid)
	}

	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "new_message",
		"message": fiber.Map{
			"message_id":        messageID,
			"chat_id":           req.ChatID,
			"sender_id":          userID,
			"sender_name":        displayName,
			"message_text":       req.MessageText,
			"parent_message_id":  req.ParentMessageID,
			"sent_at":           sentAt,
		},
	}, participantIDs)

	return c.JSON(fiber.Map{"message_id": messageID, "sent_at": sentAt})
}

// POST /messages/:message_id/react — emoji reactions
func toggleReaction(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, displayName, _ := mw.GetCurrentUser(c)
	var req struct { Emoji string `json:"emoji"` }
	c.BodyParser(&req)

	res, _ := db.DB.Exec("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji)
	affected, _ := res.RowsAffected()

	var action string
	if affected == 0 {
		db.DB.Exec("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)", msgID, userID, req.Emoji)
		action = "add"
	} else {
		action = "remove"
	}

	var chatID int
	db.DB.QueryRow("SELECT chat_id FROM messages WHERE message_id = ?", msgID).Scan(&chatID)
	
	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", chatID)
	defer pRows.Close()
	var pids []int
	for pRows.Next() {
		var pid int; pRows.Scan(&pid); pids = append(pids, pid)
	}

	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "reaction_update",
		"data": fiber.Map{
			"message_id": msgID,
			"user_id":    userID,
			"user_name":  displayName,
			"emoji":      req.Emoji,
			"action":     action,
		},
	}, pids)

	return c.JSON(fiber.Map{"status": "ok", "action": action})
}

func editMessage(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)
	var req struct { MessageText string `json:"message_text"` }
	c.BodyParser(&req)

	db.DB.Exec("UPDATE messages SET message_text = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP WHERE message_id = ? AND sender_id = ?", req.MessageText, msgID, userID)
	return c.JSON(fiber.Map{"status": "ok"})
}

func deleteMessage(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)
	db.DB.Exec("UPDATE messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE message_id = ? AND sender_id = ?", msgID, userID)
	return c.JSON(fiber.Map{"status": "ok"})
}

func getMessageReaders(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	rows, _ := db.DB.Query("SELECT u.display_name FROM message_reads mr JOIN users u ON mr.user_id = u.user_id WHERE mr.message_id = ?", msgID)
	defer rows.Close()
	var readers []string
	for rows.Next() {
		var d string; rows.Scan(&d); readers = append(readers, d)
	}
	return c.JSON(readers)
}

func markMessageRead(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)
	db.DB.Exec("INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)", msgID, userID)
	return c.JSON(fiber.Map{"status": "ok"})
}
