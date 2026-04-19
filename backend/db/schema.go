package db

import (
	"log"
	"os"
	"time"
)

// CreateSchema creates all tables if they don't exist
func CreateSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
		google_id     TEXT NOT NULL UNIQUE,
		email         TEXT NOT NULL UNIQUE,
		username      TEXT NOT NULL UNIQUE,
		display_name  TEXT NOT NULL UNIQUE,
		role          TEXT NOT NULL DEFAULT 'user',
		last_seen     DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chats (
		chat_id    INTEGER PRIMARY KEY AUTOINCREMENT,
		chat_type  TEXT NOT NULL CHECK(chat_type IN ('group', 'private')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chat_participants (
		participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
		chat_id        INTEGER NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
		user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		is_banned      INTEGER NOT NULL DEFAULT 0,
		muted_until    DATETIME,
		joined_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(chat_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS image_files (
		file_id    TEXT PRIMARY KEY,
		file_path  TEXT NOT NULL,
		width      INTEGER,
		height     INTEGER,
		is_sticker INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS messages (
		message_id   INTEGER PRIMARY KEY AUTOINCREMENT,
		chat_id      INTEGER NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
		sender_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		message_text TEXT NOT NULL DEFAULT '',
		image_file_id TEXT REFERENCES image_files(file_id) ON DELETE SET NULL,
		is_edited    INTEGER NOT NULL DEFAULT 0,
		is_deleted   INTEGER NOT NULL DEFAULT 0,
		edited_at    DATETIME,
		deleted_at   DATETIME,
		sent_at      DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS message_reads (
		read_id    INTEGER PRIMARY KEY AUTOINCREMENT,
		message_id INTEGER NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
		user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(message_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS user_favorites (
		favorite_id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		media_url   TEXT NOT NULL,
		media_type  TEXT NOT NULL,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := DB.Exec(schema)
	return err
}

// SeedMainChat ensures chat_id=1 (Main_Group_Chat) always exists
func SeedMainChat() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM chats WHERE chat_id = 1").Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		_, err = DB.Exec("INSERT INTO chats (chat_id, chat_type) VALUES (1, 'group')")
		if err != nil {
			return err
		}
		log.Println("[DB] Seeded main group chat (chat_id=1)")
	}
	return nil
}

// MigrateParticipants ensures every existing user is a participant in chat_id=1 (main group chat).
// This is idempotent — safe to run on every startup.
func MigrateParticipants() error {
	_, err := DB.Exec(`
		INSERT OR IGNORE INTO chat_participants (chat_id, user_id)
		SELECT 1, user_id FROM users
	`)
	if err != nil {
		return err
	}
	log.Println("[DB] Participant migration complete")
	return nil
}

// DeleteOldMessages removes messages older than 30 minutes and their associated image files
func DeleteOldMessages() error {
	cutoff := time.Now().Add(-30 * time.Minute)

	// Fetch images associated with expiring messages
	rows, err := DB.Query(`
		SELECT m.message_id, i.file_id, i.file_path
		FROM messages m
		INNER JOIN image_files i ON m.image_file_id = i.file_id
		WHERE m.sent_at < ? AND i.is_sticker = 0
	`, cutoff)
	if err != nil {
		return err
	}
	defer rows.Close()

	type imageInfo struct{ fileID, filePath string }
	var images []imageInfo
	var count int

	for rows.Next() {
		var msgID int64
		var fileID, filePath *string
		if err := rows.Scan(&msgID, &fileID, &filePath); err != nil {
			continue
		}
		count++
		if fileID != nil && filePath != nil {
			images = append(images, imageInfo{*fileID, *filePath})
		}
	}

	if count == 0 {
		return nil
	}

	// Delete image files from disk
	for _, img := range images {
		if err := os.Remove(img.filePath); err != nil && !os.IsNotExist(err) {
			log.Printf("[Cleanup] Failed to remove image file %s: %v", img.filePath, err)
		}
		DB.Exec("DELETE FROM image_files WHERE file_id = ?", img.fileID)
	}

	// Delete old messages (cascade removes message_reads)
	_, err = DB.Exec("DELETE FROM messages WHERE sent_at < ?", cutoff)
	if err != nil {
		return err
	}

	log.Printf("[Cleanup] Deleted %d expired messages", count)
	return nil
}
