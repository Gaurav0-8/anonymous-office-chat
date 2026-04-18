package models

import "time"

// User represents a registered user
type User struct {
	UserID       int       `json:"user_id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	Role         string    `json:"role"`
	LastSeen     time.Time `json:"last_seen"`
	CreatedAt    time.Time `json:"created_at"`
}

// Chat represents a chat room (group or private)
type Chat struct {
	ChatID    int       `json:"chat_id"`
	ChatType  string    `json:"chat_type"`
	CreatedAt time.Time `json:"created_at"`
}

// Participant is a user in a chat with status info
type Participant struct {
	UserID      int        `json:"user_id"`
	DisplayName string     `json:"display_name"`
	IsMuted     bool       `json:"is_muted"`
	IsBanned    bool       `json:"is_banned"`
	IsOnline    bool       `json:"is_online"`
	MutedUntil  *time.Time `json:"muted_until,omitempty"`
}

// Message represents a chat message
type Message struct {
	MessageID   int        `json:"message_id"`
	ChatID      int        `json:"chat_id"`
	SenderID    int        `json:"sender_id"`
	SenderName  string     `json:"sender_name"`
	MessageText string     `json:"message_text"`
	SentAt      time.Time  `json:"sent_at"`
	IsRead      bool       `json:"is_read"`
	IsEdited    bool       `json:"is_edited"`
	IsDeleted   bool       `json:"is_deleted"`
	ImageFileID *string    `json:"image_file_id,omitempty"`
	ImageWidth  *int       `json:"image_width,omitempty"`
	ImageHeight *int       `json:"image_height,omitempty"`
	EditedAt    *time.Time `json:"edited_at,omitempty"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
}

// ImageFile represents an uploaded image
type ImageFile struct {
	FileID    string    `json:"file_id"`
	FilePath  string    `json:"file_path"`
	Width     *int      `json:"width,omitempty"`
	Height    *int      `json:"height,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// Favorite represents a saved media item
type Favorite struct {
	FavoriteID int       `json:"favorite_id"`
	MediaURL   string    `json:"media_url"`
	MediaType  string    `json:"media_type"`
	CreatedAt  time.Time `json:"created_at"`
}

// ChatSummary is returned in my-chats list
type ChatSummary struct {
	ChatID          int        `json:"chat_id"`
	LastMessage     *string    `json:"last_message"`
	LastMessageTime *time.Time `json:"last_message_time"`
	LastMessageID   *int       `json:"last_message_id"`
	LastSenderName  *string    `json:"last_sender_name"`
	UnreadCount     int        `json:"unread_count"`
}

// --- Request bodies ---

type RegisterRequest struct {
	Username        string `json:"username"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	DisplayName     string `json:"display_name"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateMessageRequest struct {
	ChatID      int    `json:"chat_id"`
	MessageText string `json:"message_text"`
}

type EditMessageRequest struct {
	MessageText string `json:"message_text"`
}

type PrivateChatRequest struct {
	TargetUserID int `json:"target_user_id"`
}

type AddFavoriteRequest struct {
	MediaURL  string `json:"media_url"`
	MediaType string `json:"media_type"`
}

type MuteRequest struct {
	MutedUntil string `json:"muted_until"` // RFC3339 format
}

// WSMessage is a JSON payload sent over WebSocket
type WSMessage struct {
	Type    string      `json:"type"`
	Message interface{} `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}
