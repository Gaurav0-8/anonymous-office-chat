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

func getMainChat(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)
	var isBanned int
	db.DB.QueryRow("SELECT is_banned FROM chat_participants WHERE chat_id = 1 AND user_id = ?", userID).Scan(&isBanned)
	if isBanned == 1 { return fiber.NewError(fiber.StatusForbidden, "User is banned") }

	rows, _ := db.DB.Query("SELECT u.user_id, u.display_name, cp.is_banned, cp.muted_until FROM chat_participants cp JOIN users u ON cp.user_id = u.user_id WHERE cp.chat_id = 1")
	defer rows.Close()
	return c.JSON(fiber.Map{"chat_id": 1, "chat_type": "group", "participants": buildParticipants(rows)})
}

func createPrivateChat(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)
	var req struct { TargetUserID int `json:"target_user_id"` }
	c.BodyParser(&req)

	res, _ := db.DB.Exec("INSERT INTO chats (chat_type) VALUES ('private')")
	newChatID, _ := res.LastInsertId()
	db.DB.Exec("INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)", newChatID, userID, newChatID, req.TargetUserID)
	return c.JSON(fiber.Map{"chat_id": newChatID, "chat_type": "private", "display_name": displayName})
}

func getUserChats(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)
	rows, _ := db.DB.Query(`
		SELECT c.chat_id, 
		(SELECT message_text FROM messages WHERE chat_id = c.chat_id ORDER BY sent_at DESC LIMIT 1) as last_text
		FROM chats c JOIN chat_participants cp ON c.chat_id = cp.chat_id WHERE cp.user_id = ?`, userID)
	defer rows.Close()
	var res []fiber.Map
	for rows.Next() {
		var id int; var last *string
		rows.Scan(&id, &last)
		res = append(res, fiber.Map{"chat_id": id, "last_message": last})
	}
	return c.JSON(res)
}

// GET /chats/:chat_id/messages — now with Reactions and Replies!
func getChatMessages(c *fiber.Ctx) error {
	chatID, _ := c.ParamsInt("chat_id")
	userID, _, _, _ := mw.GetCurrentUser(c)

	rows, err := db.DB.Query(`
		SELECT m.message_id, m.sender_id, u.display_name, m.message_text, m.sent_at, m.is_edited, m.image_file_id, m.parent_message_id,
		(SELECT message_text FROM messages WHERE message_id = m.parent_message_id) as parent_text,
		(SELECT display_name FROM users WHERE user_id = (SELECT sender_id FROM messages WHERE message_id = m.parent_message_id)) as parent_sender
		FROM messages m 
		JOIN users u ON m.sender_id = u.user_id
		WHERE m.chat_id = ? AND m.is_deleted = 0
		ORDER BY m.sent_at DESC LIMIT 40
	`, chatID)
	if err != nil { return err }
	defer rows.Close()

	var messages []fiber.Map
	for rows.Next() {
		var mID, sID, isEdited int
		var sName, text string
		var sentAt time.Time
		var imgID, pID *string
		var pText, pSender *string
		rows.Scan(&mID, &sID, &sName, &text, &sentAt, &isEdited, &imgID, &pID, &pText, &pSender)

		// Fetch reactions for this message
		reactRows, _ := db.DB.Query("SELECT emoji, COUNT(*), MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) FROM message_reactions WHERE message_id = ? GROUP BY emoji", userID, mID)
		var reactions []fiber.Map
		for reactRows.Next() {
			var emoji string; var count, me int
			reactRows.Scan(&emoji, &count, &me)
			reactions = append(reactions, fiber.Map{"emoji": emoji, "count": count, "me": me == 1})
		}
		reactRows.Close()

		messages = append(messages, fiber.Map{
			"message_id":        mID,
			"sender_id":         sID,
			"sender_name":       sName,
			"message_text":      text,
			"sent_at":           sentAt,
			"is_edited":          isEdited == 1,
			"image_file_id":     imgID,
			"parent_id":         pID,
			"parent_text":       pText,
			"parent_sender":     pSender,
			"reactions":         reactions,
		})
	}

	// Reverse for frontend
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return c.JSON(messages)
}

func getChatDetails(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("chat_id")
	rows, _ := db.DB.Query("SELECT u.display_name FROM chat_participants cp JOIN users u ON cp.user_id = u.user_id WHERE cp.chat_id = ?", id)
	defer rows.Close()
	var ps []string
	for rows.Next() { var d string; rows.Scan(&d); ps = append(ps, d) }
	return c.JSON(fiber.Map{"chat_id": id, "participants": ps})
}

func buildParticipants(rows *sql.Rows) []fiber.Map {
	var res []fiber.Map
	for rows.Next() {
		var id, banned int; var name string; var muted *time.Time
		rows.Scan(&id, &name, &banned, &muted)
		res = append(res, fiber.Map{"user_id": id, "display_name": name})
	}
	return res
}
