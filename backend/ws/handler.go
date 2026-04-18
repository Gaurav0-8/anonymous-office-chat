package ws

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/gaurav/chat-app/middleware"
)

// SetupWSRoute registers the WebSocket upgrade route
func SetupWSRoute(app *fiber.App) {
	// Upgrade middleware — checks that it's a WS request
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(handleWebSocket))
}

// handleWebSocket handles the full WebSocket lifecycle for a connected client
func handleWebSocket(conn *websocket.Conn) {
	// Authenticate via ?token= query param
	tokenStr := conn.Query("token")
	if tokenStr == "" {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(1008, "Missing token"))
		return
	}

	claims, err := middleware.ParseToken(tokenStr)
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(1008, "Invalid token"))
		return
	}

	userID := claims.UserID
	Hub.Connect(conn, userID)
	defer Hub.Disconnect(conn, userID)

	log.Printf("[WS] User %d (%s) authenticated and connected", userID, claims.DisplayName)

	// Keep connection alive — listen for any incoming messages (typing indicators etc.)
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			// Normal disconnect or error
			break
		}
	}
}
