package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
)

// SetupFavoriteRoutes registers all /favorites routes
func SetupFavoriteRoutes(app *fiber.App) {
	favs := app.Group("/favorites", mw.AuthRequired())
	favs.Get("", getFavorites)
	favs.Post("", addFavorite)
	favs.Delete("/:favorite_id", removeFavorite)
}

// GET /favorites — list current user's saved favorites
func getFavorites(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)

	rows, err := db.DB.Query(
		"SELECT favorite_id, media_url, media_type, created_at FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	favorites := []fiber.Map{}
	for rows.Next() {
		var id int
		var mediaURL, mediaType string
		var createdAt time.Time
		rows.Scan(&id, &mediaURL, &mediaType, &createdAt)
		favorites = append(favorites, fiber.Map{
			"favorite_id": id,
			"media_url":   mediaURL,
			"media_type":  mediaType,
			"created_at":  createdAt,
		})
	}
	return c.JSON(favorites)
}

// POST /favorites — save a media item as a favorite
func addFavorite(c *fiber.Ctx) error {
	userID, _, _, _ := mw.GetCurrentUser(c)

	var req struct {
		MediaURL  string `json:"media_url"`
		MediaType string `json:"media_type"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if req.MediaURL == "" || req.MediaType == "" {
		return fiber.NewError(fiber.StatusBadRequest, "media_url and media_type are required")
	}

	res, err := db.DB.Exec(
		"INSERT INTO user_favorites (user_id, media_url, media_type) VALUES (?, ?, ?)",
		userID, req.MediaURL, req.MediaType,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to add favorite")
	}
	favID, _ := res.LastInsertId()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"favorite_id": favID,
		"media_url":   req.MediaURL,
		"media_type":  req.MediaType,
		"created_at":  time.Now(),
	})
}

// DELETE /favorites/:favorite_id — remove a favorite (only if owned by current user)
func removeFavorite(c *fiber.Ctx) error {
	favID, err := c.ParamsInt("favorite_id")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid favorite_id")
	}
	userID, _, _, _ := mw.GetCurrentUser(c)

	res, err := db.DB.Exec(
		"DELETE FROM user_favorites WHERE favorite_id = ? AND user_id = ?", favID, userID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Favorite not found")
	}
	return c.JSON(fiber.Map{"status": "success"})
}
