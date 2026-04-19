package handlers

import (
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
	"github.com/gaurav/chat-app/ws"
)

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
	_ = db.DB.QueryRow("SELECT is_banned FROM chat_participants WHERE chat_id = 1 AND user_id = ?", userID).Scan(&isBanned)
	if isBanned == 1 { return fiber.NewError(fiber.StatusForbidden, "User is banned") }

	rows, _ := db.DB.Query("SELECT u.user_id, u.display_name FROM chat_participants cp JOIN users u ON cp.user_id = u.user_id WHERE cp.chat_id = 1")
	defer rows.Close()
	var ps []fiber.Map
	for rows.Next() {
		var id int; var name string
		rows.Scan(&id, &name)
		ps = append(ps, fiber.Map{"user_id": id, "display_name": name})
	}
	return c.JSON(fiber.Map{"chat_id": 1, "chat_type": "group", "participants": ps})
}

func createPrivateChat(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)
	var req struct { TargetUserID int `json:"target_user_id"` }
	if err := c.BodyParser(&req); err != nil { return err }

	var chatID int
	err := db.DB.QueryRow(`
		SELECT cp1.chat_id FROM chat_participants cp1
		JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
		JOIN chats c ON cp1.chat_id = c.chat_id
		WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.chat_type = 'private'
	`, userID, req.TargetUserID).Scan(&chatID)

	if err == nil {
		return c.JSON(fiber.Map{"chat_id": chatID})
	}

	tx, err := db.DB.Begin()
	if err != nil { return err }

	res, err := tx.Exec("INSERT INTO chats (chat_type) VALUES ('private')")
	if err != nil { tx.Rollback(); return err }
	
	newChatID, _ := res.LastInsertId()
	_, err = tx.Exec("INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)", newChatID, userID, newChatID, req.TargetUserID)
	if err != nil { tx.Rollback(); return err }

	if err := tx.Commit(); err != nil { return err }

	// Notify both participants via WebSocket so sidebars update instantly
	ws.Hub.BroadcastToUsers(fiber.Map{
		"type":    "new_chat",
		"chat_id": newChatID,
	}, []int{userID, req.TargetUserID})

	return c.JSON(fiber.Map{"chat_id": newChatID})
}

func getUserChats(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)
	rows, err := db.DB.Query(`
		SELECT 
			c.chat_id, 
			c.chat_type,
			u.display_name as other_name
		FROM chats c
		JOIN chat_participants cp ON c.chat_id = cp.chat_id
		LEFT JOIN chat_participants cp2 ON c.chat_id = cp2.chat_id AND cp2.user_id != cp.user_id
		LEFT JOIN users u ON cp2.user_id = u.user_id
		WHERE cp.user_id = ?
		ORDER BY c.created_at DESC`, userID)
	if err != nil { return err }
	defer rows.Close()
	
	var res []fiber.Map
	for rows.Next() {
		var id int; var cType string; var name *string
		rows.Scan(&id, &cType, &name)
		
		displayName := "Group Chat"
		if cType == "private" {
			if name != nil { 
				displayName = *name 
			} else {
				displayName = "Anonymous User"
			}
		}
		res = append(res, fiber.Map{"chat_id": id, "chat_type": cType, "last_sender_name": displayName})
	}
	return c.JSON(res)
}

func getChatMessages(c *fiber.Ctx) error {
	chatID, _ := c.ParamsInt("chat_id")
	userID, _, _, _ := mw.GetCurrentUser(c)

	rows, err := db.DB.Query(`
		SELECT m.message_id, m.sender_id, u.display_name, m.message_text, m.sent_at, m.image_file_id, 
		f.file_path, m.parent_message_id,
		(SELECT message_text FROM messages WHERE message_id = m.parent_message_id) as p_text,
		(SELECT u2.display_name FROM messages m2 JOIN users u2 ON m2.sender_id = u2.user_id WHERE m2.message_id = m.parent_message_id) as p_sender
		FROM messages m 
		JOIN users u ON m.sender_id = u.user_id
		LEFT JOIN image_files f ON m.image_file_id = f.file_id
		WHERE m.chat_id = ? AND m.is_deleted = 0
		ORDER BY m.sent_at DESC LIMIT 60
	`, chatID)
	if err != nil { return err }
	defer rows.Close()

	var msgs []fiber.Map
	for rows.Next() {
		var mID, sID int
		var sName, text, sentAt string
		var imgID, imgPath, pID, pText, pSender *string
		rows.Scan(&mID, &sID, &sName, &text, &sentAt, &imgID, &imgPath, &pID, &pText, &pSender)

		imgURL := ""
		if imgPath != nil { imgURL = "/uploads/" + filepath.Base(*imgPath) }

		reactRows, _ := db.DB.Query("SELECT emoji, COUNT(*), MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) FROM message_reactions WHERE message_id = ? GROUP BY emoji", userID, mID)
		var reacts []fiber.Map
		for reactRows.Next() {
			var e string; var c, me int
			reactRows.Scan(&e, &c, &me)
			reacts = append(reacts, fiber.Map{"emoji": e, "count": c, "me": me == 1})
		}
		reactRows.Close()

		msgs = append(msgs, fiber.Map{
			"message_id":    mID,
			"sender_id":     sID,
			"sender_name":   sName,
			"message_text":  text,
			"sent_at":       sentAt,
			"image_file_id": imgID,
			"image_url":     imgURL,
			"parent_id":     pID,
			"parent_text":   pText,
			"parent_sender": pSender,
			"reactions":     reacts,
		})
	}

	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 { msgs[i], msgs[j] = msgs[j], msgs[i] }
	return c.JSON(msgs)
}

func getChatDetails(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("chat_id")
	rows, _ := db.DB.Query("SELECT u.user_id, u.display_name FROM chat_participants cp JOIN users u ON cp.user_id = u.user_id WHERE cp.chat_id = ?", id)
	defer rows.Close()
	var ps []fiber.Map
	for rows.Next() { 
		var uid int; var d string; 
		rows.Scan(&uid, &d); 
		ps = append(ps, fiber.Map{"user_id": uid, "display_name": d}) 
	}
	return c.JSON(fiber.Map{"chat_id": id, "participants": ps})
}
