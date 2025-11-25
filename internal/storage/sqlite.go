package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // Pure Go SQLite driver (no CGO required)
)

// ExecutionStatus represents the current state of a workflow execution
type ExecutionStatus string

const (
	ExecutionStatusRunning   ExecutionStatus = "running"
	ExecutionStatusCompleted ExecutionStatus = "completed"
	ExecutionStatusFailed    ExecutionStatus = "failed"
)

// Execution represents a single workflow execution instance
// This allows tracking history of all runs, not just the latest state
type Execution struct {
	ID          string
	WorkflowID  string
	Status      ExecutionStatus
	State       []byte
	StartedAt   time.Time
	CompletedAt *time.Time
	Error       *string
}

// Storage defines the interface for workflow persistence
// Migration from workflow-state model to execution-history model
// This allows tracking full execution history (like n8n)
type Storage interface {
	// Execution Management - track history of all workflow runs
	CreateExecution(ctx context.Context, workflowID string) (executionID string, err error)
	UpdateExecutionStatus(ctx context.Context, executionID string, status ExecutionStatus, state []byte, errorMsg *string) error
	GetExecution(ctx context.Context, executionID string) (*Execution, error)
	ListExecutions(ctx context.Context, workflowID string, limit int) ([]*Execution, error)

	// Node Results - now tied to execution_id instead of workflow_id
	SaveNodeResult(ctx context.Context, executionID, nodeID string, result []byte) error
	GetNodeResult(ctx context.Context, executionID, nodeID string) ([]byte, error)

	Close() error
}

// SQLiteStorage implements Storage using modernc.org/sqlite (Pure Go)
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLite creates a new SQLite-backed storage
// Uses modernc.org/sqlite for cross-platform builds without CGO
func NewSQLite(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Initialize schema
	if err := initSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return &SQLiteStorage{db: db}, nil
}

// initSchema creates necessary tables for execution history tracking
// Migration from single-state model to full execution history
func initSchema(db *sql.DB) error {
	schema := `
	-- Execution History: track all workflow runs (not just latest state)
	-- Each workflow run gets a unique execution_id (UUID)
	CREATE TABLE IF NOT EXISTS workflow_executions (
		execution_id TEXT PRIMARY KEY,
		workflow_id TEXT NOT NULL,
		status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
		state BLOB NOT NULL,
		started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME,
		error TEXT
	);

	-- Index for querying execution history by workflow (most recent first)
	CREATE INDEX IF NOT EXISTS idx_executions_workflow 
		ON workflow_executions(workflow_id, started_at DESC);

	-- Index for querying by status (e.g., find all failed executions)
	CREATE INDEX IF NOT EXISTS idx_executions_status
		ON workflow_executions(status, started_at DESC);

	-- Node Results: now tied to execution_id instead of workflow_id
	-- This allows tracking node outputs for each specific execution
	CREATE TABLE IF NOT EXISTS node_results (
		execution_id TEXT NOT NULL,
		node_id TEXT NOT NULL,
		result BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (execution_id, node_id),
		FOREIGN KEY (execution_id) REFERENCES workflow_executions(execution_id) ON DELETE CASCADE
	);
	`

	_, err := db.Exec(schema)
	return err
}

// CreateExecution creates a new workflow execution instance
// Returns a unique execution_id (UUID) for tracking this specific run
func (s *SQLiteStorage) CreateExecution(ctx context.Context, workflowID string) (string, error) {
	// Generate UUID for execution (using timestamp-based approach for simplicity)
	// In production, consider using github.com/google/uuid
	executionID := fmt.Sprintf("%s-%d", workflowID, time.Now().UnixNano())

	query := `
		INSERT INTO workflow_executions (execution_id, workflow_id, status, state, started_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
	`
	_, err := s.db.ExecContext(ctx, query, executionID, workflowID, ExecutionStatusRunning, []byte("{}"))
	if err != nil {
		return "", fmt.Errorf("failed to create execution: %w", err)
	}
	return executionID, nil
}

// UpdateExecutionStatus updates the status and state of an execution
// Used to mark execution as completed or failed, and store final state
func (s *SQLiteStorage) UpdateExecutionStatus(ctx context.Context, executionID string, status ExecutionStatus, state []byte, errorMsg *string) error {
	query := `
		UPDATE workflow_executions 
		SET status = ?, state = ?, completed_at = CURRENT_TIMESTAMP, error = ?
		WHERE execution_id = ?
	`
	_, err := s.db.ExecContext(ctx, query, status, state, errorMsg, executionID)
	if err != nil {
		return fmt.Errorf("failed to update execution status: %w", err)
	}
	return nil
}

// GetExecution retrieves a specific execution by ID
func (s *SQLiteStorage) GetExecution(ctx context.Context, executionID string) (*Execution, error) {
	query := `
		SELECT execution_id, workflow_id, status, state, started_at, completed_at, error
		FROM workflow_executions
		WHERE execution_id = ?
	`

	var exec Execution
	var completedAt sql.NullTime
	var errorMsg sql.NullString

	err := s.db.QueryRowContext(ctx, query, executionID).Scan(
		&exec.ID,
		&exec.WorkflowID,
		&exec.Status,
		&exec.State,
		&exec.StartedAt,
		&completedAt,
		&errorMsg,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	if completedAt.Valid {
		exec.CompletedAt = &completedAt.Time
	}
	if errorMsg.Valid {
		exec.Error = &errorMsg.String
	}

	return &exec, nil
}

// ListExecutions retrieves execution history for a workflow
// Returns most recent executions first, limited by the limit parameter
func (s *SQLiteStorage) ListExecutions(ctx context.Context, workflowID string, limit int) ([]*Execution, error) {
	query := `
		SELECT execution_id, workflow_id, status, state, started_at, completed_at, error
		FROM workflow_executions
		WHERE workflow_id = ?
		ORDER BY started_at DESC
		LIMIT ?
	`

	rows, err := s.db.QueryContext(ctx, query, workflowID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list executions: %w", err)
	}
	defer rows.Close()

	var executions []*Execution
	for rows.Next() {
		var exec Execution
		var completedAt sql.NullTime
		var errorMsg sql.NullString

		err := rows.Scan(
			&exec.ID,
			&exec.WorkflowID,
			&exec.Status,
			&exec.State,
			&exec.StartedAt,
			&completedAt,
			&errorMsg,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan execution: %w", err)
		}

		if completedAt.Valid {
			exec.CompletedAt = &completedAt.Time
		}
		if errorMsg.Valid {
			exec.Error = &errorMsg.String
		}

		executions = append(executions, &exec)
	}

	return executions, rows.Err()
}

// SaveNodeResult persists the result of a single node execution
// Now tied to execution_id to track results per specific workflow run
func (s *SQLiteStorage) SaveNodeResult(ctx context.Context, executionID, nodeID string, result []byte) error {
	query := `
		INSERT INTO node_results (execution_id, node_id, result, created_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(execution_id, node_id) DO UPDATE SET
			result = excluded.result,
			created_at = CURRENT_TIMESTAMP
	`
	_, err := s.db.ExecContext(ctx, query, executionID, nodeID, result)
	if err != nil {
		return fmt.Errorf("failed to save node result: %w", err)
	}
	return nil
}

// GetNodeResult retrieves the result of a specific node execution
func (s *SQLiteStorage) GetNodeResult(ctx context.Context, executionID, nodeID string) ([]byte, error) {
	var result []byte
	query := `SELECT result FROM node_results WHERE execution_id = ? AND node_id = ?`
	err := s.db.QueryRowContext(ctx, query, executionID, nodeID).Scan(&result)
	if err != nil {
		return nil, fmt.Errorf("failed to get node result: %w", err)
	}
	return result, nil
}

// Close releases database resources
func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}
