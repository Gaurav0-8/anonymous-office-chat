package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
)

// SetupChatRoutes registers all /chats routes
func SetupChatRoutes(app *fiber.App) {
	chats := app.Group("/chats", mw.AuthRequired())
	chats.Get("/main", getMainChat)
	chats.Post("/private", createPrivateChat)
	chats.Get("/my-chats", getUserChats)
	chats.Get("/:chat_id/messages", getChatMessages)
	chats.Get("/:chat_id/details", getChatDetails)
}

// GET /chats/main — returns Main_Group_Chat (chat_id=1) with participants
func getMainChat(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Check if user is banned
	var isBanned int
	db.DB.QueryRow(
		"SELECT is_banned FROM chat_participants WHERE chat_id = 1 AND user_id = ?", userID,
	).Scan(&isBanned)
	if isBanned == 1 {
		return fiber.NewError(fiber.StatusForbidden, "User is banned")
	}

	// Get participants
	rows, err := db.DB.Query(`
		SELECT u.user_id, u.display_name, cp.is_banned, cp.muted_until
		FROM chat_participants cp
		INNER JOIN users u ON cp.user_id = u.user_id
		WHERE cp.chat_id = 1
		ORDER BY u.display_name
	`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	participants := buildParticipants(rows)

	return c.JSON(fiber.Map{
		"chat_id":      1,
		"chat_type":    "group",
		"participants": participants,
	})
}

// POST /chats/private — create or return existing private chat between two users
func createPrivateChat(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)

	var req struct {
		TargetUserID int `json:"target_user_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	if req.TargetUserID == userID {
		return fiber.NewError(fiber.StatusBadRequest, "Cannot create private chat with yourself")
	}

	// Check if user is banned from main chat
	var isBanned int
	db.DB.QueryRow(
		"SELECT is_banned FROM chat_participants WHERE chat_id = 1 AND user_id = ?", userID,
	).Scan(&isBanned)
	if isBanned == 1 {
		return fiber.NewError(fiber.StatusForbidden, "User is banned")
	}

	// Verify target user exists
	var targetDisplayName string
	err := db.DB.QueryRow(
		"SELECT display_name FROM users WHERE user_id = ?", req.TargetUserID,
	).Scan(&targetDisplayName)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Target user not found")
	}

	// Check for existing private chat between these two users
	var existingChatID int
	err = db.DB.QueryRow(`
		SELECT c.chat_id FROM chats c
		WHERE c.chat_type = 'private'
		  AND EXISTS (SELECT 1 FROM chat_participants cp1 WHERE cp1.chat_id = c.chat_id AND cp1.user_id = ?)
		  AND EXISTS (SELECT 1 FROM chat_participants cp2 WHERE cp2.chat_id = c.chat_id AND cp2.user_id = ?)
		LIMIT 1
	`, userID, req.TargetUserID).Scan(&existingChatID)

	if err == nil {
		// Return existing chat
		return c.JSON(fiber.Map{
			"chat_id":   existingChatID,
			"chat_type": "private",
			"created":   false,
			"participants": []fiber.Map{
				{"user_id": userID, "display_name": displayName},
				{"user_id": req.TargetUserID, "display_name": targetDisplayName},
			},
		})
	}

	// Create new private chat
	res, err := db.DB.Exec("INSERT INTO chats (chat_type) VALUES ('private')")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create chat")
	}
	newChatID, _ := res.LastInsertId()

	db.DB.Exec(
		"INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)",
		newChatID, userID, newChatID, req.TargetUserID,
	)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"chat_id":   newChatID,
		"chat_type": "private",
		"created":   true,
		"participants": []fiber.Map{
			{"user_id": userID, "display_name": displayName},
			{"user_id": req.TargetUserID, "display_name": targetDisplayName},
		},
	})
}

// GET /chats/my-chats — list all chats for current user with last message + unread count
func getUserChats(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Get all chats the user is part of
	chatRows, err := db.DB.Query(`
		SELECT c.chat_id
		FROM chats c
		INNER JOIN chat_participants cp ON c.chat_id = cp.chat_id
		WHERE cp.user_id = ?
	`, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer chatRows.Close()

	var chatIDs []int
	for chatRows.Next() {
		var id int
		chatRows.Scan(&id)
		chatIDs = append(chatIDs, id)
	}

	result := []fiber.Map{}
	for _, chatID := range chatIDs {
		// Get last message
		var lastMsg *string
		var lastTime *time.Time
		var lastMsgID *int
		var lastSender *string

		row := db.DB.QueryRow(`
			SELECT m.message_text, m.sent_at, m.message_id, u.display_name
			FROM messages m
			INNER JOIN users u ON m.sender_id = u.user_id
			WHERE m.chat_id = ? AND m.is_deleted = 0
			ORDER BY m.sent_at DESC
			LIMIT 1
		`, chatID)
		var txt string
		var t time.Time
		var mid int
		var snd string
		if err := row.Scan(&txt, &t, &mid, &snd); err == nil {
			lastMsg = &txt
			lastTime = &t
			lastMsgID = &mid
			lastSender = &snd
		}

		// Unread count
		var unread int
		db.DB.QueryRow(`
			SELECT COUNT(*) FROM messages m
			WHERE m.chat_id = ?
			  AND m.sender_id != ?
			  AND m.is_deleted = 0
			  AND NOT EXISTS (
			    SELECT 1 FROM message_reads mr
			    WHERE mr.message_id = m.message_id AND mr.user_id = ?
			  )
		`, chatID, userID, userID).Scan(&unread)

		result = append(result, fiber.Map{
			"chat_id":           chatID,
			"last_message":      lastMsg,
			"last_message_time": lastTime,
			"last_message_id":   lastMsgID,
			"last_sender_name":  lastSender,
			"unread_count":      unread,
		})
	}

	return c.JSON(result)
}

// GET /chats/:chat_id/messages — last 20 messages, oldest to newest
func getChatMessages(c *fiber.Ctx) error {
	chatID, err := c.ParamsInt("chat_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid chat_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Verify participation
	var participates int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?", chatID, userID,
	).Scan(&participates)
	if participates == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not a participant in this chat")
	}

	rows, err := db.DB.Query(`
		SELECT m.message_id, m.sender_id, u.display_name, m.message_text,
		       m.sent_at, m.is_edited, m.image_file_id,
		       CASE WHEN mr.message_id IS NOT NULL THEN 1 ELSE 0 END as is_read,
		       i.width, i.height
		FROM messages m
		INNER JOIN users u ON m.sender_id = u.user_id
		LEFT JOIN message_reads mr ON mr.message_id = m.message_id AND mr.user_id = ?
		LEFT JOIN image_files i ON m.image_file_id = i.file_id
		WHERE m.chat_id = ? AND m.is_deleted = 0
		ORDER BY m.sent_at DESC
		LIMIT 20
	`, userID, chatID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	var messages []fiber.Map
	for rows.Next() {
		var msgID, senderID, isEdited, isRead int
		var senderName, msgText string
		var sentAt time.Time
		var imageFileID *string
		var imgWidth, imgHeight *int

		rows.Scan(&msgID, &senderID, &senderName, &msgText, &sentAt, &isEdited, &imageFileID, &isRead, &imgWidth, &imgHeight)
		messages = append(messages, fiber.Map{
			"message_id":   msgID,
			"sender_id":    senderID,
			"sender_name":  senderName,
			"message_text": msgText,
			"sent_at":      sentAt,
			"is_edited":    isEdited == 1,
			"is_read":      isRead == 1,
			"image_file_id": imageFileID,
			"image_width":  imgWidth,
			"image_height": imgHeight,
		})
	}

	// Reverse to oldest-first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	if messages == nil {
		messages = []fiber.Map{}
	}
	return c.JSON(messages)
}

// GET /chats/:chat_id/details — full chat info with participants
func getChatDetails(c *fiber.Ctx) error {
	chatID, err := c.ParamsInt("chat_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid chat_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	var participates int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?", chatID, userID,
	).Scan(&participates)
	if participates == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not a participant in this chat")
	}

	var chatType string
	err = db.DB.QueryRow("SELECT chat_type FROM chats WHERE chat_id = ?", chatID).Scan(&chatType)
	if err == sql.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "Chat not found")
	}

	rows, err := db.DB.Query(`
		SELECT u.user_id, u.display_name, cp.is_banned, cp.muted_until
		FROM chat_participants cp
		INNER JOIN users u ON cp.user_id = u.user_id
		WHERE cp.chat_id = ?
		ORDER BY u.display_name
	`, chatID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	participants := buildParticipants(rows)

	return c.JSON(fiber.Map{
		"chat_id":      chatID,
		"chat_type":    chatType,
		"participants": participants,
	})
}

// buildParticipants converts participant rows to a slice of maps
func buildParticipants(rows *sql.Rows) []fiber.Map {
	participants := []fiber.Map{}
	now := time.Now()

	for rows.Next() {
		var uid, isBanned int
		var displayName string
		var mutedUntil *time.Time

		rows.Scan(&uid, &displayName, &isBanned, &mutedUntil)

		isMuted := mutedUntil != nil && mutedUntil.After(now)

		participants = append(participants, fiber.Map{
			"user_id":      uid,
			"display_name": displayName,
			"is_banned":    isBanned == 1,
			"is_muted":     isMuted,
			"is_online":    false, // Will be enhanced with WS hub lookup
			"muted_until":  mutedUntil,
		})
	}
	return participants
}
