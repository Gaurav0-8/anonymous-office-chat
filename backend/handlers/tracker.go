package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"

	"github.com/gaurav/chat-app/db"
	mw "github.com/gaurav/chat-app/middleware"
	"github.com/gofiber/fiber/v2"
)

type CategoryResponse struct {
	ID    string         `json:"id"`
	Name  string         `json:"name"`
	Color string         `json:"color"`
	Tasks []TaskResponse `json:"tasks"`
}

type TaskResponse struct {
	ID        string `json:"id"`
	RowID     int    `json:"rowId"`
	Title     string `json:"title"`
	Owner     string `json:"owner"`
	StartDate string `json:"startDate"`
	Duration  int    `json:"duration"`
	Progress  int    `json:"progress"`
	Status    string `json:"status"`
	DueDate   string `json:"dueDate"`
}

type RequestResponse struct {
	ID          string          `json:"id"`
	CatID       string          `json:"catId"`
	TaskID      string          `json:"taskId"`
	TaskTitle   string          `json:"taskTitle"`
	Field       string          `json:"field"`
	OldValue    int             `json:"oldValue"`
	NewValue    int             `json:"newValue"`
	RequestedBy RequesterDetail `json:"requestedBy"`
	RequestedAt string          `json:"requestedAt"`
	Status      string          `json:"status"`
}

type RequesterDetail struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture,omitempty"`
}

const adminPassword = "Tracker-Protiviti@123"

// SetupTrackerRoutes registers all tracker API routes
func SetupTrackerRoutes(app *fiber.App) {
	// Public auth route
	app.Post("/auth/tracker/admin", trackerAdminLogin)

	// Protected routes (requires login)
	tracker := app.Group("/tracker", mw.AuthRequired())
	
	// Read tasks (available to all logged in users)
	tracker.Get("/categories", getTrackerCategories)

	// Change requests submitted by users
	tracker.Post("/requests", submitChangeRequest)

	// Admin-only operations
	admin := tracker.Group("/", trackerAdminOnly())
	
	// Category management
	admin.Post("/categories", createCategory)
	admin.Put("/categories/:id", updateCategory)
	admin.Delete("/categories/:id", deleteCategory)

	// Task management
	admin.Post("/tasks", createTask)
	admin.Put("/tasks/:id", updateTask)
	admin.Delete("/tasks/:id", deleteTask)

	// Request management
	admin.Get("/requests", getChangeRequests)
	admin.Put("/requests/:id/approve", approveChangeRequest)
	admin.Put("/requests/:id/reject", rejectChangeRequest)
}

// Admin-only middleware
func trackerAdminOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(string)
		if role != "admin" {
			return fiber.NewError(fiber.StatusForbidden, "Admin access required")
		}
		return c.Next()
	}
}

// POST /auth/tracker/admin
func trackerAdminLogin(c *fiber.Ctx) error {
	var req struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	if req.Password != adminPassword {
		return fiber.NewError(fiber.StatusUnauthorized, "Incorrect password")
	}

	// Dynamically query or insert admin user to avoid hardcoded ID conflicts
	var userID int
	err := db.DB.QueryRow("SELECT user_id FROM users WHERE username = 'tracker_admin'").Scan(&userID)
	if err == sql.ErrNoRows {
		res, err := db.DB.Exec(
			`INSERT INTO users (username, display_name, email, role) 
			 VALUES ('tracker_admin', 'Admin', 'admin@protiviti.com', 'admin')`,
		)
		if err != nil {
			log.Printf("[TrackerAuth] Failed to insert admin user: %v", err)
			return fiber.NewError(fiber.StatusInternalServerError, "Database error initializing admin session")
		}
		id, _ := res.LastInsertId()
		userID = int(id)
	} else if err != nil {
		log.Printf("[TrackerAuth] Failed to query admin user: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}

	token, err := createJWT(userID, "tracker_admin", "Admin", "admin")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(fiber.Map{
		"access_token": token,
		"token_type":   "bearer",
		"user": fiber.Map{
			"user_id":      userID,
			"display_name": "Admin",
			"role":         "admin",
		},
	})
}

// GET /tracker/categories
func getTrackerCategories(c *fiber.Ctx) error {
	rows, err := db.DB.Query("SELECT id, name, color FROM tracker_categories")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	var categories []CategoryResponse
	for rows.Next() {
		var cat CategoryResponse
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Color); err != nil {
			return err
		}
		cat.Tasks = []TaskResponse{}
		categories = append(categories, cat)
	}

	for i := range categories {
		taskRows, err := db.DB.Query(
			`SELECT id, row_id, title, owner, start_date, duration, progress, status, due_date 
			 FROM tracker_tasks WHERE category_id = ? ORDER BY row_id ASC`,
			categories[i].ID,
		)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "Failed to query tasks")
		}
		defer taskRows.Close()

		for taskRows.Next() {
			var task TaskResponse
			if err := taskRows.Scan(
				&task.ID, &task.RowID, &task.Title, &task.Owner,
				&task.StartDate, &task.Duration, &task.Progress, &task.Status, &task.DueDate,
			); err != nil {
				return err
			}
			categories[i].Tasks = append(categories[i].Tasks, task)
		}
	}

	return c.JSON(categories)
}

// POST /tracker/categories
func createCategory(c *fiber.Ctx) error {
	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Category name is required")
	}
	if req.Color == "" {
		req.Color = "#6b7280"
	}

	id := "cat_" + generateUID()
	_, err := db.DB.Exec(
		"INSERT INTO tracker_categories (id, name, color) VALUES (?, ?, ?)",
		id, req.Name, req.Color,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "name": req.Name, "color": req.Color})
}

// PUT /tracker/categories/:id
func updateCategory(c *fiber.Ctx) error {
	id := c.Params("id")
	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" || req.Color == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Name and Color are required")
	}

	res, err := db.DB.Exec(
		"UPDATE tracker_categories SET name = ?, color = ? WHERE id = ?",
		req.Name, req.Color, id,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Category not found")
	}

	return c.JSON(fiber.Map{"status": "updated"})
}

// DELETE /tracker/categories/:id
func deleteCategory(c *fiber.Ctx) error {
	id := c.Params("id")
	res, err := db.DB.Exec("DELETE FROM tracker_categories WHERE id = ?", id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Category not found")
	}
	return c.JSON(fiber.Map{"status": "deleted"})
}

// POST /tracker/tasks
func createTask(c *fiber.Ctx) error {
	var req struct {
		CategoryID string `json:"category_id"`
		Title      string `json:"title"`
		Owner      string `json:"owner"`
		StartDate  string `json:"startDate"`
		Duration   int    `json:"duration"`
		Progress   int    `json:"progress"`
		Status     string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil || req.CategoryID == "" || req.Title == "" || req.StartDate == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Required fields missing")
	}
	if req.Duration < 1 {
		req.Duration = 1
	}

	dueDate := db.AddDays(req.StartDate, req.Duration)
	id := "t_" + generateUID()

	// Get next row_id
	var maxRow sql.NullInt64
	db.DB.QueryRow("SELECT MAX(row_id) FROM tracker_tasks WHERE category_id = ?", req.CategoryID).Scan(&maxRow)
	nextRow := 1
	if maxRow.Valid {
		nextRow = int(maxRow.Int64) + 1
	}

	_, err := db.DB.Exec(
		`INSERT INTO tracker_tasks (id, category_id, row_id, title, owner, start_date, duration, progress, status, due_date) 
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.CategoryID, nextRow, req.Title, req.Owner, req.StartDate, req.Duration, req.Progress, req.Status, dueDate,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "rowId": nextRow})
}

// PUT /tracker/tasks/:id
func updateTask(c *fiber.Ctx) error {
	id := c.Params("id")
	var req struct {
		CategoryID string `json:"category_id"`
		Title      string `json:"title"`
		Owner      string `json:"owner"`
		StartDate  string `json:"startDate"`
		Duration   int    `json:"duration"`
		Progress   int    `json:"progress"`
		Status     string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil || req.CategoryID == "" || req.Title == "" || req.StartDate == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Required fields missing")
	}
	if req.Duration < 1 {
		req.Duration = 1
	}

	// Check if category changed. If yes, we remove it from old category and append to new category (updating row_ids)
	var oldCatID string
	var oldRowID int
	err := db.DB.QueryRow("SELECT category_id, row_id FROM tracker_tasks WHERE id = ?", id).Scan(&oldCatID, &oldRowID)
	if err == sql.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "Task not found")
	}

	dueDate := db.AddDays(req.StartDate, req.Duration)

	if oldCatID != req.CategoryID {
		// Moving categories
		// 1. Shift row IDs down in old category
		db.DB.Exec("UPDATE tracker_tasks SET row_id = row_id - 1 WHERE category_id = ? AND row_id > ?", oldCatID, oldRowID)

		// 2. Get next row ID in new category
		var maxRow sql.NullInt64
		db.DB.QueryRow("SELECT MAX(row_id) FROM tracker_tasks WHERE category_id = ?", req.CategoryID).Scan(&maxRow)
		nextRow := 1
		if maxRow.Valid {
			nextRow = int(maxRow.Int64) + 1
		}

		// 3. Update task with new category and row_id
		_, err = db.DB.Exec(
			`UPDATE tracker_tasks SET category_id = ?, row_id = ?, title = ?, owner = ?, start_date = ?, duration = ?, progress = ?, status = ?, due_date = ?
			 WHERE id = ?`,
			req.CategoryID, nextRow, req.Title, req.Owner, req.StartDate, req.Duration, req.Progress, req.Status, dueDate, id,
		)
	} else {
		// Category not changed, normal update
		_, err = db.DB.Exec(
			`UPDATE tracker_tasks SET title = ?, owner = ?, start_date = ?, duration = ?, progress = ?, status = ?, due_date = ?
			 WHERE id = ?`,
			req.Title, req.Owner, req.StartDate, req.Duration, req.Progress, req.Status, dueDate, id,
		)
	}

	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database update error")
	}

	return c.JSON(fiber.Map{"status": "updated"})
}

// DELETE /tracker/tasks/:id
func deleteTask(c *fiber.Ctx) error {
	id := c.Params("id")

	var catID string
	var rowID int
	err := db.DB.QueryRow("SELECT category_id, row_id FROM tracker_tasks WHERE id = ?", id).Scan(&catID, &rowID)
	if err == sql.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "Task not found")
	}

	_, err = db.DB.Exec("DELETE FROM tracker_tasks WHERE id = ?", id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database delete error")
	}

	// Shift remaining row IDs down
	db.DB.Exec("UPDATE tracker_tasks SET row_id = row_id - 1 WHERE category_id = ? AND row_id > ?", catID, rowID)

	return c.JSON(fiber.Map{"status": "deleted"})
}

// GET /tracker/requests
func getChangeRequests(c *fiber.Ctx) error {
	rows, err := db.DB.Query(
		`SELECT r.id, r.category_id, r.task_id, r.task_title, r.field, r.old_value, r.new_value, r.requested_at, r.status,
		        u.display_name, u.email, u.avatar_url
		 FROM tracker_requests r
		 JOIN users u ON r.requested_by = u.user_id
		 ORDER BY r.status = 'pending' DESC, r.requested_at DESC`,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database query failed")
	}
	defer rows.Close()

	var requests []RequestResponse
	for rows.Next() {
		var req RequestResponse
		var displayName, email string
		var avatarURL sql.NullString
		var requestedAt string

		if err := rows.Scan(
			&req.ID, &req.CatID, &req.TaskID, &req.TaskTitle, &req.Field, &req.OldValue, &req.NewValue, &requestedAt, &req.Status,
			&displayName, &email, &avatarURL,
		); err != nil {
			return err
		}

		req.RequestedAt = requestedAt
		req.RequestedBy = RequesterDetail{
			Name:  displayName,
			Email: email,
		}
		if avatarURL.Valid {
			req.RequestedBy.Picture = avatarURL.String
		}

		requests = append(requests, req)
	}

	return c.JSON(requests)
}

// POST /tracker/requests
func submitChangeRequest(c *fiber.Ctx) error {
	var req struct {
		CategoryID string `json:"category_id"`
		TaskID     string `json:"task_id"`
		TaskTitle  string `json:"task_title"`
		Field      string `json:"field"`
		OldValue   int    `json:"old_value"`
		NewValue   int    `json:"new_value"`
	}
	if err := c.BodyParser(&req); err != nil || req.CategoryID == "" || req.TaskID == "" || req.Field == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Required fields missing")
	}

	userID := c.Locals("user_id").(int)
	id := "req_" + generateUID()

	_, err := db.DB.Exec(
		`INSERT INTO tracker_requests (id, category_id, task_id, task_title, field, old_value, new_value, requested_by, status) 
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
		id, req.CategoryID, req.TaskID, req.TaskTitle, req.Field, req.OldValue, req.NewValue, userID,
	)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database error submitting request")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

// PUT /tracker/requests/:id/approve
func approveChangeRequest(c *fiber.Ctx) error {
	id := c.Params("id")

	var taskID, field string
	var newValue int
	err := db.DB.QueryRow("SELECT task_id, field, new_value FROM tracker_requests WHERE id = ? AND status = 'pending'", id).Scan(&taskID, &field, &newValue)
	if err == sql.ErrNoRows {
		return fiber.NewError(fiber.StatusNotFound, "Pending request not found")
	}

	// 1. Fetch task details to apply update
	var startDate string
	var duration, progress int
	err = db.DB.QueryRow("SELECT start_date, duration, progress FROM tracker_tasks WHERE id = ?", taskID).Scan(&startDate, &duration, &progress)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to locate corresponding task")
	}

	// 2. Apply field change
	var updateQuery string
	var updateArg interface{}
	if field == "duration" {
		dueDate := db.AddDays(startDate, newValue)
		updateQuery = "UPDATE tracker_tasks SET duration = ?, due_date = ? WHERE id = ?"
		updateArg = dueDate
		_, err = db.DB.Exec(updateQuery, newValue, updateArg, taskID)
	} else if field == "progress" {
		// If progress reaches 100%, update status to "Done".
		// Otherwise we keep it as is, or we can transition from Not Started to In Progress
		var nextStatus string
		if newValue == 100 {
			nextStatus = "Done"
		} else if newValue > 0 {
			// Get current status
			var currentStatus string
			db.DB.QueryRow("SELECT status FROM tracker_tasks WHERE id = ?", taskID).Scan(&currentStatus)
			if currentStatus == "Not Started" {
				nextStatus = "In Progress"
			} else {
				nextStatus = currentStatus
			}
		}
		if nextStatus != "" {
			updateQuery = "UPDATE tracker_tasks SET progress = ?, status = ? WHERE id = ?"
			_, err = db.DB.Exec(updateQuery, newValue, nextStatus, taskID)
		} else {
			updateQuery = "UPDATE tracker_tasks SET progress = ? WHERE id = ?"
			_, err = db.DB.Exec(updateQuery, newValue, taskID)
		}
	}

	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update task")
	}

	// 3. Mark request approved
	_, _ = db.DB.Exec("UPDATE tracker_requests SET status = 'approved' WHERE id = ?", id)

	return c.JSON(fiber.Map{"status": "approved"})
}

// PUT /tracker/requests/:id/reject
func rejectChangeRequest(c *fiber.Ctx) error {
	id := c.Params("id")
	res, err := db.DB.Exec("UPDATE tracker_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'", id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Database update error")
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Pending request not found")
	}
	return c.JSON(fiber.Map{"status": "rejected"})
}

// Helper to generate a random 8-character UID
func generateUID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	n, _ := rand.Int(rand.Reader, big.NewInt(1000))
	return fmt.Sprintf("%s%03d", hex.EncodeToString(b), n.Int64())
}
