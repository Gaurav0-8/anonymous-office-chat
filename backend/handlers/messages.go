package handlers

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
	"github.com/gaurav/chat-app/ws"
)

func SetupMessageRoutes(app *fiber.App) {
	msgs := app.Group("/messages", mw.AuthRequired())
	msgs.Post("", createMessage)
	msgs.Patch("/:message_id/edit", editMessage)
	msgs.Patch("/:message_id/delete", deleteMessage)
	msgs.Get("/:message_id/readers", getMessageReaders)
	msgs.Post("/:message_id/read", markMessageRead)
	msgs.Post("/:message_id/react", toggleReaction)
}

func createMessage(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Fetch fresh display name from DB to prevent stale names from old JWT tokens
	var displayName string
	err := db.DB.QueryRow("SELECT display_name FROM users WHERE user_id = ?", userID).Scan(&displayName)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to verify user")
	}

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

	var participates int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?", req.ChatID, userID).Scan(&participates)
	if participates == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not a participant")
	}

	res, err := db.DB.Exec(
		"INSERT INTO messages (chat_id, sender_id, message_text, parent_message_id) VALUES (?, ?, ?, ?)",
		req.ChatID, userID, req.MessageText, req.ParentMessageID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to send")
	}
	messageID, _ := res.LastInsertId()
	sentAt := time.Now()

	// REAL-TIME QUOTE FIX: Fetch parent info if this is a reply
	var pText, pSender *string
	if req.ParentMessageID != nil {
		_ = db.DB.QueryRow(`
			SELECT m.message_text, u.display_name 
			FROM messages m JOIN users u ON m.sender_id = u.user_id 
			WHERE m.message_id = ?`, *req.ParentMessageID).Scan(&pText, &pSender)
	}

	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", req.ChatID)
	defer pRows.Close()
	var pids []int
	for pRows.Next() {
		var pid int
		if err := pRows.Scan(&pid); err == nil { pids = append(pids, pid) }
	}

	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "new_message",
		"message": fiber.Map{
			"message_id":        messageID,
			"chat_id":           req.ChatID,
			"sender_id":         userID,
			"sender_name":       displayName,
			"message_text":      req.MessageText,
			"parent_id":         req.ParentMessageID,
			"parent_text":       pText,
			"parent_sender":     pSender,
			"sent_at":           sentAt,
		},
	}, pids)

	return c.JSON(fiber.Map{"message_id": messageID, "sent_at": sentAt})
}

func toggleReaction(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Fetch fresh display name from DB to prevent stale names from old JWT tokens
	var displayName string
	_ = db.DB.QueryRow("SELECT display_name FROM users WHERE user_id = ?", userID).Scan(&displayName)
	var req struct { Emoji string `json:"emoji"` }
	if err := c.BodyParser(&req); err != nil { return err }

	res, _ := db.DB.Exec("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji)
	affected, _ := res.RowsAffected()

	action := "add"
	if affected > 0 {
		action = "remove"
	} else {
		_, err := db.DB.Exec("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)", msgID, userID, req.Emoji)
		if err != nil { return err }
	}

	var chatID int
	_ = db.DB.QueryRow("SELECT chat_id FROM messages WHERE message_id = ?", msgID).Scan(&chatID)
	
	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", chatID)
	defer pRows.Close()
	var pids []int
	for pRows.Next() {
		var pid int
		if err := pRows.Scan(&pid); err == nil { pids = append(pids, pid) }
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
	if err := c.BodyParser(&req); err != nil { return err }

	_, _ = db.DB.Exec("UPDATE messages SET message_text = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP WHERE message_id = ? AND sender_id = ?", req.MessageText, msgID, userID)
	return c.JSON(fiber.Map{"status": "ok"})
}

func deleteMessage(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)
	_, _ = db.DB.Exec("UPDATE messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE message_id = ? AND sender_id = ?", msgID, userID)
	return c.JSON(fiber.Map{"status": "ok"})
}

func getMessageReaders(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	rows, err := db.DB.Query("SELECT u.display_name FROM message_reads mr JOIN users u ON mr.user_id = u.user_id WHERE mr.message_id = ?", msgID)
	if err != nil { return err }
	defer rows.Close()
	var readers []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err == nil { readers = append(readers, d) }
	}
	return c.JSON(readers)
}

func markMessageRead(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)
	_, err := db.DB.Exec("INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)", msgID, userID)
	if err != nil { log.Println("Read error:", err) }
	return c.JSON(fiber.Map{"status": "ok"})
}
