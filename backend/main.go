package main

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"

	"github.com/gaurav/chat-app/db"
	"github.com/gaurav/chat-app/handlers"
	"github.com/gaurav/chat-app/ws"
)

func main() {
	// Load .env file if present
	if err := godotenv.Load(); err != nil {
		log.Println("[Main] No .env file found, using environment variables")
	}

	// Initialize SQLite database (creates schema + seeds main chat)
	if err := db.InitDB(); err != nil {
		log.Fatalf("[Main] Failed to initialize database: %v", err)
	}
	defer db.CloseDB()

	// Ensure uploads directory exists
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	os.MkdirAll(uploadDir, 0755)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"detail": err.Error()})
		},
		BodyLimit: 15 * 1024 * 1024, // 15MB max body
	})

	// Middleware
	app.Use(logger.New())
	
	// FIXED CORS: specific origins required when withCredentials is true
	app.Use(cors.New(cors.Config{
		AllowOrigins: "https://chat.gauravmathur.in,https://gauravmathur.in,http://localhost:3000",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization,X-Admin-Setup-Token",
		AllowCredentials: true,
	}))

	// Serve uploaded files statically
	app.Static("/uploads", uploadDir)

	// Register all route groups
	handlers.SetupAuthRoutes(app)
	handlers.SetupGoogleAuthRoutes(app)
	handlers.SetupChatRoutes(app)
	handlers.SetupMessageRoutes(app)
	handlers.SetupImageRoutes(app)
	handlers.SetupFavoriteRoutes(app)
	handlers.SetupAdminRoutes(app)
	ws.SetupWSRoute(app)

	// Health check
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"message": "Chat Messaging API is running (Go + SQLite)",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[Main] Server starting on port %s", port)

	// Background Janitor: Cleanup old messages and images (24 Hour Rule)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			// 1. Delete expired messages
			res, err := db.DB.Exec("DELETE FROM messages WHERE datetime(sent_at) < datetime('now', '-24 hours')")
			if err == nil {
				if n, _ := res.RowsAffected(); n > 0 {
					log.Printf("[Janitor] Wiped %d expired messages", n)
				}
			}

			// 2. Identify orphaned image files
			_, _ = db.DB.Exec("DELETE FROM image_files WHERE uploaded_at < datetime('now', '-24 hours')")
		}
	}()

	log.Fatal(app.Listen(":" + port))
}
