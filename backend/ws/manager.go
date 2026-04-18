package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/websocket/v2"
)

// Manager holds all active WebSocket connections keyed by user_id
type Manager struct {
	mu          sync.RWMutex
	connections map[int][]*websocket.Conn
}

// Global singleton manager
var Hub = &Manager{
	connections: make(map[int][]*websocket.Conn),
}

// Connect registers a new WebSocket connection for a user
func (m *Manager) Connect(conn *websocket.Conn, userID int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connections[userID] = append(m.connections[userID], conn)
	log.Printf("[WS] User %d connected (total connections: %d)", userID, len(m.connections[userID]))
}

// Disconnect removes a WebSocket connection for a user
func (m *Manager) Disconnect(conn *websocket.Conn, userID int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conns := m.connections[userID]
	for i, c := range conns {
		if c == conn {
			m.connections[userID] = append(conns[:i], conns[i+1:]...)
			break
		}
	}
	if len(m.connections[userID]) == 0 {
		delete(m.connections, userID)
	}
	log.Printf("[WS] User %d disconnected", userID)
}

// SendToUser sends a JSON payload to all connections of a specific user
func (m *Manager) SendToUser(payload interface{}, userID int) {
	m.mu.RLock()
	conns := m.connections[userID]
	m.mu.RUnlock()

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[WS] Failed to marshal message: %v", err)
		return
	}

	for _, conn := range conns {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("[WS] Write error for user %d: %v", userID, err)
		}
	}
}

// BroadcastToUsers sends a payload to multiple users (e.g., all chat participants)
func (m *Manager) BroadcastToUsers(payload interface{}, userIDs []int) {
	for _, uid := range userIDs {
		m.SendToUser(payload, uid)
	}
}

// IsOnline checks whether a user has at least one active connection
func (m *Manager) IsOnline(userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.connections[userID]) > 0
}
