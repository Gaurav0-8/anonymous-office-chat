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

const maxUploadSizeMB = 10

// SetupImageRoutes registers all /images routes
func SetupImageRoutes(app *fiber.App) {
	imgs := app.Group("/images", mw.AuthRequired())
	imgs.Post("/upload", uploadImage)
	imgs.Get("/stickers", listStickers)
	imgs.Post("/message", sendImageMessage)
	imgs.Post("/:file_id/read", markImageRead)
	// Static file serving is handled by app.Static("/uploads", ...) in main.go
}

// POST /images/upload — upload an image file, returns file_id
func uploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "No file uploaded")
	}

	isSticker := c.FormValue("is_sticker") == "true"

	// Size check
	if file.Size > maxUploadSizeMB*1024*1024 {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("File too large (max %dMB)", maxUploadSizeMB))
	}

	// Extension check
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		return fiber.NewError(fiber.StatusBadRequest, "File type not allowed")
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	os.MkdirAll(uploadDir, 0755)

	fileID := uuid.New().String()
	fileName := fileID + ext
	filePath := filepath.Join(uploadDir, fileName)

	if err := c.SaveFile(file, filePath); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to save file")
	}

	// Detect image dimensions
	var width, height *int
	if f, err := os.Open(filePath); err == nil {
		defer f.Close()
		if cfg, _, err := image.DecodeConfig(f); err == nil {
			w, h := cfg.Width, cfg.Height
			width, height = &w, &h
		}
	}

	// Store metadata
	_, err = db.DB.Exec(
		"INSERT INTO image_files (file_id, file_path, width, height, is_sticker) VALUES (?, ?, ?, ?, ?)",
		fileID, filePath, width, height, isSticker,
	)
	if err != nil {
		os.Remove(filePath)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to store image metadata")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"file_id":  fileID,
		"url":      "/uploads/" + fileName,
		"width":    width,
		"height":   height,
		"is_sticker": isSticker,
	})
}

// GET /images/stickers — returns list of all community stickers
func listStickers(c *fiber.Ctx) error {
	rows, err := db.DB.Query("SELECT file_id, file_path, width, height FROM image_files WHERE is_sticker = 1 ORDER BY created_at DESC")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to query stickers")
	}
	defer rows.Close()

	var stickers []fiber.Map
	for rows.Next() {
		var id, path string
		var w, h *int
		rows.Scan(&id, &path, &w, &h)
		
		// Convert path to URL
		ext := filepath.Ext(path)
		url := "/uploads/" + id + ext

		stickers = append(stickers, fiber.Map{
			"id":     id,
			"url":    url,
			"width":  w,
			"height": h,
		})
	}

	return c.JSON(stickers)
}

// POST /images/message — send a message that includes an image (with optional text)
func sendImageMessage(c *fiber.Ctx) error {
	userID, _, displayName, _ := mw.GetCurrentUser(c)

	var req struct {
		ChatID      int    `json:"chat_id"`
		FileID      string `json:"file_id"`
		MessageText string `json:"message_text"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if req.ChatID == 0 || req.FileID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "chat_id and file_id are required")
	}

	// Verify image exists (if not a remote URL)
	var imgWidth, imgHeight *int
	isRemote := strings.HasPrefix(req.FileID, "http://") || strings.HasPrefix(req.FileID, "https://")

	if !isRemote {
		var filePath string
		err := db.DB.QueryRow(
			"SELECT file_path, width, height FROM image_files WHERE file_id = ?", req.FileID,
		).Scan(&filePath, &imgWidth, &imgHeight)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "Image not found")
		}
	} else {
		// For remote URLs, we don't know dimensions upfront
	}

	// Verify participation
	var count int
	db.DB.QueryRow(
		"SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?", req.ChatID, userID,
	).Scan(&count)
	if count == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Not a participant in this chat")
	}

	res, err := db.DB.Exec(
		"INSERT INTO messages (chat_id, sender_id, message_text, image_file_id) VALUES (?, ?, ?, ?)",
		req.ChatID, userID, req.MessageText, req.FileID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create message")
	}
	messageID, _ := res.LastInsertId()

	// Broadcast to participants
	pRows, _ := db.DB.Query("SELECT user_id FROM chat_participants WHERE chat_id = ?", req.ChatID)
	defer pRows.Close()
	var participantIDs []int
	for pRows.Next() {
		var pid int
		pRows.Scan(&pid)
		participantIDs = append(participantIDs, pid)
	}

	sentAt := time.Now()
	ws.Hub.BroadcastToUsers(fiber.Map{
		"type": "new_message",
		"message": fiber.Map{
			"message_id":    messageID,
			"chat_id":       req.ChatID,
			"sender_id":     userID,
			"sender_name":   displayName,
			"message_text":  req.MessageText,
			"sent_at":       sentAt,
			"is_edited":     false,
			"image_file_id": req.FileID,
			"image_width":   imgWidth,
			"image_height":  imgHeight,
		},
	}, participantIDs)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message_id":    messageID,
		"chat_id":       req.ChatID,
		"sender_id":     userID,
		"message_text":  req.MessageText,
		"image_file_id": req.FileID,
		"image_width":   imgWidth,
		"image_height":  imgHeight,
		"sent_at":       sentAt,
	})
}

// POST /images/:file_id/read — mark an image message as read
func markImageRead(c *fiber.Ctx) error {
	fileID := c.Params("file_id")
	userID, _, _, _ := mw.GetCurrentUser(c)

	// Find the message with this image
	var msgID int
	err := db.DB.QueryRow(
		"SELECT message_id FROM messages WHERE image_file_id = ? LIMIT 1", fileID,
	).Scan(&msgID)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Image message not found")
	}

	db.DB.Exec(
		"INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)", msgID, userID,
	)
	return c.JSON(fiber.Map{"status": "ok"})
}
