package db

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

// InitDB initializes the SQLite database with the full Teams-style schema
func InitDB(dataSourceName string) {
	var err error
	DB, err = sql.Open("sqlite3", dataSourceName)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Error connecting to database: %v", err)
	}

	if err := createTables(); err != nil {
		log.Fatalf("Error creating tables: %v", err)
	}

	if err := SeedMainChat(); err != nil {
		log.Fatalf("Error seeding main chat: %v", err)
	}
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
		chat_type TEXT NOT NULL, -- 'group' or 'private'
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
		image_file_id TEXT,
		parent_message_id INTEGER REFERENCES messages(message_id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS message_reads (
		message_id INTEGER REFERENCES messages(message_id) ON DELETE CASCADE,
		user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
		read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (message_id, user_id)
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

	// Force migrations for existing databases
	DB.Exec("ALTER TABLE messages ADD COLUMN parent_message_id INTEGER REFERENCES messages(message_id) ON DELETE SET NULL")
	DB.Exec(`
		CREATE TABLE IF NOT EXISTS message_reactions (
			reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
			message_id  INTEGER NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
			user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
			emoji       TEXT NOT NULL,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(message_id, user_id)
		);
	`)
	
	return nil
}

func SeedMainChat() error {
	_, err := DB.Exec("INSERT OR IGNORE INTO chats (chat_id, chat_type) VALUES (1, 'group')")
	return err
}
