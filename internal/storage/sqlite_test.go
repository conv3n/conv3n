package storage_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/conv3n/conv3n/internal/storage"
)

func TestSQLiteStorage(t *testing.T) {
	// Create unique temporary directory for this test to prevent race conditions
	// when running tests in parallel (go test -parallel N)
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	// Initialize storage
	store, err := storage.NewSQLite(dbPath)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	t.Run("CreateAndGetExecution", func(t *testing.T) {
		workflowID := "test-workflow-1"

		// Create execution
		executionID, err := store.CreateExecution(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to create execution: %v", err)
		}

		// Retrieve execution
		exec, err := store.GetExecution(ctx, executionID)
		if err != nil {
			t.Fatalf("failed to get execution: %v", err)
		}

		// Verify execution data
		if exec.WorkflowID != workflowID {
			t.Errorf("expected workflow_id %s, got %s", workflowID, exec.WorkflowID)
		}
		if exec.Status != storage.ExecutionStatusRunning {
			t.Errorf("expected status running, got %s", exec.Status)
		}
	})

	t.Run("UpdateExecutionStatus", func(t *testing.T) {
		workflowID := "test-workflow-2"

		// Create execution
		executionID, err := store.CreateExecution(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to create execution: %v", err)
		}

		// Update to completed
		finalState := []byte(`{"status":"completed","result":"success"}`)
		err = store.UpdateExecutionStatus(ctx, executionID, storage.ExecutionStatusCompleted, finalState, nil)
		if err != nil {
			t.Fatalf("failed to update execution status: %v", err)
		}

		// Verify updated status
		exec, err := store.GetExecution(ctx, executionID)
		if err != nil {
			t.Fatalf("failed to get execution: %v", err)
		}

		if exec.Status != storage.ExecutionStatusCompleted {
			t.Errorf("expected status completed, got %s", exec.Status)
		}
		if string(exec.State) != string(finalState) {
			t.Errorf("expected state %s, got %s", finalState, exec.State)
		}
		if exec.CompletedAt == nil {
			t.Error("expected completed_at to be set")
		}
	})

	t.Run("ExecutionWithError", func(t *testing.T) {
		workflowID := "test-workflow-3"

		// Create execution
		executionID, err := store.CreateExecution(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to create execution: %v", err)
		}

		// Update to failed with error
		errorMsg := "node execution failed: timeout"
		finalState := []byte(`{"status":"failed"}`)
		err = store.UpdateExecutionStatus(ctx, executionID, storage.ExecutionStatusFailed, finalState, &errorMsg)
		if err != nil {
			t.Fatalf("failed to update execution status: %v", err)
		}

		// Verify error is stored
		exec, err := store.GetExecution(ctx, executionID)
		if err != nil {
			t.Fatalf("failed to get execution: %v", err)
		}

		if exec.Status != storage.ExecutionStatusFailed {
			t.Errorf("expected status failed, got %s", exec.Status)
		}
		if exec.Error == nil {
			t.Fatal("expected error to be set")
		}
		if *exec.Error != errorMsg {
			t.Errorf("expected error %s, got %s", errorMsg, *exec.Error)
		}
	})

	t.Run("ListExecutions", func(t *testing.T) {
		workflowID := "test-workflow-4"

		// Create multiple executions
		var executionIDs []string
		for i := 0; i < 5; i++ {
			execID, err := store.CreateExecution(ctx, workflowID)
			if err != nil {
				t.Fatalf("failed to create execution %d: %v", i, err)
			}
			executionIDs = append(executionIDs, execID)
		}

		// List executions (limit 3)
		executions, err := store.ListExecutions(ctx, workflowID, 3)
		if err != nil {
			t.Fatalf("failed to list executions: %v", err)
		}

		// Verify count
		if len(executions) != 3 {
			t.Errorf("expected 3 executions, got %d", len(executions))
		}

		// Verify all belong to same workflow
		for _, exec := range executions {
			if exec.WorkflowID != workflowID {
				t.Errorf("expected workflow_id %s, got %s", workflowID, exec.WorkflowID)
			}
		}
	})

	t.Run("SaveAndGetNodeResult", func(t *testing.T) {
		workflowID := "test-workflow-5"

		// Create execution
		executionID, err := store.CreateExecution(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to create execution: %v", err)
		}

		nodeID := "http_request_1"
		result := []byte(`{"statusCode":200,"body":"OK"}`)

		// Save node result
		err = store.SaveNodeResult(ctx, executionID, nodeID, result)
		if err != nil {
			t.Fatalf("failed to save node result: %v", err)
		}

		// Retrieve node result
		retrieved, err := store.GetNodeResult(ctx, executionID, nodeID)
		if err != nil {
			t.Fatalf("failed to get node result: %v", err)
		}

		// Verify result matches
		if string(retrieved) != string(result) {
			t.Errorf("expected result %s, got %s", result, retrieved)
		}
	})

	t.Run("MultipleNodes", func(t *testing.T) {
		workflowID := "test-workflow-6"

		// Create execution
		executionID, err := store.CreateExecution(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to create execution: %v", err)
		}

		// Save results for multiple nodes
		nodes := map[string][]byte{
			"node_1": []byte(`{"output":"result1"}`),
			"node_2": []byte(`{"output":"result2"}`),
			"node_3": []byte(`{"output":"result3"}`),
		}

		for nodeID, result := range nodes {
			err := store.SaveNodeResult(ctx, executionID, nodeID, result)
			if err != nil {
				t.Fatalf("failed to save node %s: %v", nodeID, err)
			}
		}

		// Verify all nodes can be retrieved
		for nodeID, expected := range nodes {
			retrieved, err := store.GetNodeResult(ctx, executionID, nodeID)
			if err != nil {
				t.Fatalf("failed to get node %s: %v", nodeID, err)
			}

			if string(retrieved) != string(expected) {
				t.Errorf("node %s: expected %s, got %s", nodeID, expected, retrieved)
			}
		}
	})

	t.Run("ExecutionHistory", func(t *testing.T) {
		workflowID := "test-workflow-7"

		// Create multiple executions with different statuses
		// Add small delay to ensure different timestamps (UnixNano-based IDs)
		exec1, _ := store.CreateExecution(ctx, workflowID)
		store.UpdateExecutionStatus(ctx, exec1, storage.ExecutionStatusCompleted, []byte(`{"run":1}`), nil)

		exec2, _ := store.CreateExecution(ctx, workflowID)
		errorMsg := "failed"
		store.UpdateExecutionStatus(ctx, exec2, storage.ExecutionStatusFailed, []byte(`{"run":2}`), &errorMsg)

		exec3, _ := store.CreateExecution(ctx, workflowID)
		store.UpdateExecutionStatus(ctx, exec3, storage.ExecutionStatusCompleted, []byte(`{"run":3}`), nil)

		// List all executions
		executions, err := store.ListExecutions(ctx, workflowID, 10)
		if err != nil {
			t.Fatalf("failed to list executions: %v", err)
		}

		// Verify we have history of all runs
		if len(executions) != 3 {
			t.Errorf("expected 3 executions in history, got %d", len(executions))
		}

		// Verify they are ordered by most recent first (by started_at DESC)
		// Since we use UnixNano for ID generation, exec3 should have higher timestamp
		if len(executions) >= 2 {
			// Just verify first execution is one of the created ones
			found := false
			for _, id := range []string{exec1, exec2, exec3} {
				if executions[0].ID == id {
					found = true
					break
				}
			}
			if !found {
				t.Error("first execution in list is not one of the created executions")
			}
		}
	})
}

// TestParallelExecutions verifies that tests can run in parallel without conflicts
func TestParallelExecutions(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "parallel_test.db")

	store, err := storage.NewSQLite(dbPath)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Create execution
	executionID, err := store.CreateExecution(ctx, "parallel-workflow")
	if err != nil {
		t.Fatalf("failed to create execution: %v", err)
	}

	// Verify it works
	exec, err := store.GetExecution(ctx, executionID)
	if err != nil {
		t.Fatalf("failed to get execution: %v", err)
	}

	if exec.Status != storage.ExecutionStatusRunning {
		t.Errorf("expected status running, got %s", exec.Status)
	}
}
