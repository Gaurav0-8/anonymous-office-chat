package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

// DB is the global database connection pool
var DB *sql.DB

// InitDB opens the SQLite file, applies schema, and seeds initial data
func InitDB() error {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./chat.db"
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrent read performance
	if _, err = DB.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return fmt.Errorf("failed to set WAL mode: %w", err)
	}
	// Enforce foreign key constraints (disabled by default in SQLite)
	if _, err = DB.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Conservative connection pool for SQLite
	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(time.Hour)

	if err = CreateSchema(); err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	if err = SeedMainChat(); err != nil {
		return fmt.Errorf("failed to seed main chat: %w", err)
	}

	log.Println("[DB] Database initialized successfully")
	return nil
}

// CloseDB gracefully closes the database connection
func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
