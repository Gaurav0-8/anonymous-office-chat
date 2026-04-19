package db

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// InitDB matches the calling convention in main.go
func InitDB() error {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./chat.db"
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	if err := createTables(); err != nil {
		return err
	}

	if err := SeedMainChat(); err != nil {
		return err
	}

	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

func DeleteOldMessages() error {
	// Deletes messages older than 30 minutes (anonymous spirit)
	_, err := DB.Exec("DELETE FROM messages WHERE sent_at < datetime('now', '-30 minutes')")
	return err
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		user_id INTEGER PRIMARY KEY AUTOINCREMENT,
		google_id TEXT UNIQUE,
		display_name TEXT NOT NULL,
		email TEXT UNIQUE,
		avatar_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chats (
		chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
		chat_type TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chat_participants (
		chat_id INTEGER REFERENCES chats(chat_id) ON DELETE CASCADE,
		user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
		is_banned INTEGER DEFAULT 0,
		muted_until DATETIME,
		PRIMARY KEY (chat_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS messages (
		message_id INTEGER PRIMARY KEY AUTOINCREMENT,
		chat_id INTEGER REFERENCES chats(chat_id) ON DELETE CASCADE,
		sender_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
		message_text TEXT NOT NULL,
		sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		is_edited INTEGER DEFAULT 0,
		is_deleted INTEGER DEFAULT 0,
		edited_at DATETIME,
		deleted_at DATETIME,
		image_file_id TEXT,
		parent_message_id INTEGER REFERENCES messages(message_id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS message_reads (
		message_id INTEGER REFERENCES messages(message_id) ON DELETE CASCADE,
		user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
		read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (message_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS message_reactions (
		reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
		message_id  INTEGER NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
		user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		emoji       TEXT NOT NULL,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(message_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS image_files (
		file_id TEXT PRIMARY KEY,
		file_path TEXT NOT NULL,
		file_name TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		width INTEGER,
		height INTEGER,
		uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// Force migrations
	DB.Exec("ALTER TABLE messages ADD COLUMN edited_at DATETIME")
	DB.Exec("ALTER TABLE messages ADD COLUMN deleted_at DATETIME")
	DB.Exec("ALTER TABLE messages ADD COLUMN parent_message_id INTEGER REFERENCES messages(message_id) ON DELETE SET NULL")
	
	return nil
}

func SeedMainChat() error {
	_, err := DB.Exec("INSERT OR IGNORE INTO chats (chat_id, chat_type) VALUES (1, 'group')")
	return err
}
