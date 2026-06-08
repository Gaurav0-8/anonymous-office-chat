package db

import (
	"database/sql"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// InitDB initializes the SQLite database with the EXHAUSTIVE schema required by all handlers.
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

	// Seeding for project tracker if empty
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := seedTracker(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Ensure system chat exists
	_, _ = DB.Exec("INSERT OR IGNORE INTO chats (chat_id, chat_type) VALUES (1, 'group')")
	
	logDatabaseSchema()

	return nil
}

func logDatabaseSchema() {
	rows, err := DB.Query("SELECT name, sql FROM sqlite_master WHERE type='table'")
	if err != nil {
		log.Printf("[DB] Failed to query sqlite_master: %v", err)
		return
	}
	defer rows.Close()
	log.Println("[DB] Current database tables and schemas:")
	for rows.Next() {
		var name, sqlStr string
		if err := rows.Scan(&name, &sqlStr); err == nil {
			log.Printf("Table: %s | Schema: %s", name, sqlStr)
		}
	}
}


func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		user_id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE,
		password_hash TEXT,
		google_id TEXT UNIQUE,
		display_name TEXT NOT NULL,
		email TEXT,
		avatar_url TEXT,
		role TEXT DEFAULT 'user',
		last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
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
		UNIQUE(message_id, user_id, emoji)
	);

	CREATE TABLE IF NOT EXISTS image_files (
		file_id TEXT PRIMARY KEY,
		file_path TEXT NOT NULL,
		file_name TEXT DEFAULT '',
		mime_type TEXT DEFAULT 'image/png',
		size_bytes INTEGER DEFAULT 0,
		width INTEGER,
		height INTEGER,
		is_sticker INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_favorites (
		favorite_id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		media_url TEXT NOT NULL,
		media_type TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS tracker_categories (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		color TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS tracker_tasks (
		id TEXT PRIMARY KEY,
		category_id TEXT NOT NULL REFERENCES tracker_categories(id) ON DELETE CASCADE,
		row_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		owner TEXT NOT NULL,
		start_date TEXT NOT NULL,
		duration INTEGER NOT NULL,
		progress INTEGER NOT NULL,
		status TEXT NOT NULL,
		due_date TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS tracker_requests (
		id TEXT PRIMARY KEY,
		category_id TEXT NOT NULL REFERENCES tracker_categories(id) ON DELETE CASCADE,
		task_id TEXT NOT NULL REFERENCES tracker_tasks(id) ON DELETE CASCADE,
		task_title TEXT NOT NULL,
		field TEXT NOT NULL,
		old_value INTEGER NOT NULL,
		new_value INTEGER NOT NULL,
		requested_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
		requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		status TEXT NOT NULL DEFAULT 'pending'
	);
	`
	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// Comprehensive Migrations
	DB.Exec("ALTER TABLE users ADD COLUMN username TEXT UNIQUE")
	DB.Exec("ALTER TABLE users ADD COLUMN password_hash TEXT")
	DB.Exec("ALTER TABLE users ADD COLUMN last_seen DATETIME DEFAULT CURRENT_TIMESTAMP")
	DB.Exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
	
	DB.Exec("ALTER TABLE messages ADD COLUMN edited_at DATETIME")
	DB.Exec("ALTER TABLE messages ADD COLUMN deleted_at DATETIME")
	DB.Exec("ALTER TABLE messages ADD COLUMN image_file_id TEXT")
	DB.Exec("ALTER TABLE messages ADD COLUMN parent_message_id INTEGER REFERENCES messages(message_id) ON DELETE SET NULL")
	
	DB.Exec("ALTER TABLE image_files ADD COLUMN is_sticker INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE image_files ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
	DB.Exec("ALTER TABLE image_files ADD COLUMN uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP")
	DB.Exec("ALTER TABLE image_files ADD COLUMN file_name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE image_files ADD COLUMN mime_type TEXT DEFAULT 'image/png'")
	DB.Exec("ALTER TABLE image_files ADD COLUMN size_bytes INTEGER DEFAULT 0")
	
	return nil
}
