package handlers

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
	"github.com/gaurav/chat-app/ws"
)

const maxUploadSizeMB = 20

func SetupImageRoutes(app *fiber.App) {
	imgs := app.Group("/images", mw.AuthRequired())
	imgs.Post("/upload", uploadImage)
	imgs.Get("/stickers", listStickers)
	imgs.Post("/message", sendImageMessage)
	imgs.Post("/:message_id/view", confirmViewOnce)
}

func uploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil { return fiber.NewError(fiber.StatusBadRequest, "No file uploaded") }
	isSticker := c.FormValue("is_sticker") == "true"
	if file.Size > maxUploadSizeMB*1024*1024 { return fiber.NewError(fiber.StatusBadRequest, "File too large") }

	ext := strings.ToLower(filepath.Ext(file.Filename))
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" { uploadDir = "./uploads" }
	os.MkdirAll(uploadDir, 0755)

	fileID := uuid.New().String()
	fileName := fileID + ext
	filePath := filepath.Join(uploadDir, fileName)

	if err := c.SaveFile(file, filePath); err != nil { return err }

	var width, height *int
	if f, err := os.Open(filePath); err == nil {
		defer f.Close()
		if cfg, _, err := image.DecodeConfig(f); err == nil {
			w, h := cfg.Width, cfg.Height
			width, height = &w, &h
		}
	}

	_, _ = db.DB.Exec("INSERT INTO image_files (file_id, file_path, width, height, is_sticker) VALUES (?, ?, ?, ?, ?)", fileID, filePath, width, height, isSticker)

	return c.JSON(fiber.Map{
		"file_id": fileID,
		"url":     "/uploads/" + fileName,
		"width":   width,
		"height":  height,
	})
}

func sendImageMessage(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)
	var req struct {
		ChatID      int    `json:"chat_id"`
		FileID      string `json:"file_id"`
		MessageText string `json:"message_text"`
		ViewOnce    bool   `json:"view_once"`
	}
	if err := c.BodyParser(&req); err != nil { return err }

	var imgWidth, imgHeight *int
	var fileName string
	if !strings.HasPrefix(req.FileID, "http") {
		_ = db.DB.QueryRow("SELECT width, height, file_path FROM image_files WHERE file_id = ?", req.FileID).Scan(&imgWidth, &imgHeight, &fileName)
		fileName = filepath.Base(fileName)
	}

	intViewOnce := 0
	if req.ViewOnce { intViewOnce = 1 }

	res, err := db.DB.Exec(
		"INSERT INTO messages (chat_id, sender_id, message_text, image_file_id, view_once) VALUES (?, ?, ?, ?, ?)",
		req.ChatID, userID, req.MessageText, req.FileID, intViewOnce,
	)
	if err != nil { return err }
	messageID, _ := res.LastInsertId()
	sentAt := time.Now()

	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", req.ChatID)
	defer pRows.Close()
	var pids []int
	for pRows.Next() {
		var pid int
		pRows.Scan(&pid)
		pids = append(pids, pid)
	}

	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "new_message",
		"message": fiber.Map{
			"message_id":    messageID,
			"chat_id":       req.ChatID,
			"sender_id":     userID,
			"sender_name":   displayName,
			"message_text":  req.MessageText,
			"sent_at":       sentAt,
			"image_file_id": req.FileID,
			"image_url":     "/uploads/" + fileName,
			"image_width":   imgWidth,
			"image_height":  imgHeight,
			"view_once":     req.ViewOnce,
		},
	}, pids)

	return c.JSON(fiber.Map{"message_id": messageID})
}

func confirmViewOnce(c *fiber.Ctx) error {
	msgID, _ := c.ParamsInt("message_id")
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Check if message is view_once and sent to this user
	var senderID int
	var viewOnce int
	err := db.DB.QueryRow("SELECT sender_id, view_once FROM messages WHERE message_id = ?", msgID).Scan(&senderID, &viewOnce)
	if err != nil || viewOnce == 0 { return c.SendStatus(404) }

	if senderID == userID {
		// Sender viewing their own view_once doesn't kill it (optional behavior)
	} else {
		_, _ = db.DB.Exec("UPDATE messages SET viewed_at = CURRENT_TIMESTAMP WHERE message_id = ? AND viewed_at IS NULL", msgID)
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

func listStickers(c *fiber.Ctx) error {
	rows, _ := db.DB.Query("SELECT file_id, file_path FROM image_files WHERE is_sticker = 1")
	defer rows.Close()
	var list []fiber.Map
	for rows.Next() {
		var id, path string
		rows.Scan(&id, &path)
		list = append(list, fiber.Map{"id": id, "url": "/uploads/" + filepath.Base(path)})
	}
	return c.JSON(list)
}
