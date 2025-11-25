package storage

import (
	"context"
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite" // Pure Go SQLite driver (no CGO required)
)

// Storage defines the interface for workflow persistence
// This abstraction allows easy migration to BadgerDB in the future
type Storage interface {
	SaveWorkflowState(ctx context.Context, workflowID string, state []byte) error
	GetWorkflowState(ctx context.Context, workflowID string) ([]byte, error)
	SaveNodeResult(ctx context.Context, workflowID, nodeID string, result []byte) error
	GetNodeResult(ctx context.Context, workflowID, nodeID string) ([]byte, error)
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

// initSchema creates necessary tables if they don't exist
func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS workflow_states (
		workflow_id TEXT PRIMARY KEY,
		state BLOB NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS node_results (
		workflow_id TEXT NOT NULL,
		node_id TEXT NOT NULL,
		result BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (workflow_id, node_id)
	);

	CREATE INDEX IF NOT EXISTS idx_workflow_states_updated 
		ON workflow_states(updated_at);
	`

	_, err := db.Exec(schema)
	return err
}

// SaveWorkflowState persists the entire workflow state
func (s *SQLiteStorage) SaveWorkflowState(ctx context.Context, workflowID string, state []byte) error {
	query := `
		INSERT INTO workflow_states (workflow_id, state, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(workflow_id) DO UPDATE SET
			state = excluded.state,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := s.db.ExecContext(ctx, query, workflowID, state)
	if err != nil {
		return fmt.Errorf("failed to save workflow state: %w", err)
	}
	return nil
}

// GetWorkflowState retrieves the workflow state by ID
func (s *SQLiteStorage) GetWorkflowState(ctx context.Context, workflowID string) ([]byte, error) {
	var state []byte
	query := `SELECT state FROM workflow_states WHERE workflow_id = ?`
	err := s.db.QueryRowContext(ctx, query, workflowID).Scan(&state)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}
	return state, nil
}

// SaveNodeResult persists the result of a single node execution
func (s *SQLiteStorage) SaveNodeResult(ctx context.Context, workflowID, nodeID string, result []byte) error {
	query := `
		INSERT INTO node_results (workflow_id, node_id, result, created_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(workflow_id, node_id) DO UPDATE SET
			result = excluded.result,
			created_at = CURRENT_TIMESTAMP
	`
	_, err := s.db.ExecContext(ctx, query, workflowID, nodeID, result)
	if err != nil {
		return fmt.Errorf("failed to save node result: %w", err)
	}
	return nil
}

// GetNodeResult retrieves the result of a specific node execution
func (s *SQLiteStorage) GetNodeResult(ctx context.Context, workflowID, nodeID string) ([]byte, error) {
	var result []byte
	query := `SELECT result FROM node_results WHERE workflow_id = ? AND node_id = ?`
	err := s.db.QueryRowContext(ctx, query, workflowID, nodeID).Scan(&result)
	if err != nil {
		return nil, fmt.Errorf("failed to get node result: %w", err)
	}
	return result, nil
}

// Close releases database resources
func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}
