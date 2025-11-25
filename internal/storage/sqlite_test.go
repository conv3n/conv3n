package storage_test

import (
	"context"
	"os"
	"testing"

	"github.com/conv3n/conv3n/internal/storage"
)

func TestSQLiteStorage(t *testing.T) {
	// Create temporary database file
	tmpFile := "/tmp/test_conv3n.db"
	defer os.Remove(tmpFile)

	// Initialize storage
	store, err := storage.NewSQLite(tmpFile)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	t.Run("SaveAndGetWorkflowState", func(t *testing.T) {
		workflowID := "test-workflow-1"
		state := []byte(`{"status":"running","step":1}`)

		// Save state
		err := store.SaveWorkflowState(ctx, workflowID, state)
		if err != nil {
			t.Fatalf("failed to save workflow state: %v", err)
		}

		// Retrieve state
		retrieved, err := store.GetWorkflowState(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to get workflow state: %v", err)
		}

		// Verify state matches
		if string(retrieved) != string(state) {
			t.Errorf("expected state %s, got %s", state, retrieved)
		}
	})

	t.Run("UpdateWorkflowState", func(t *testing.T) {
		workflowID := "test-workflow-2"
		initialState := []byte(`{"status":"pending"}`)
		updatedState := []byte(`{"status":"completed"}`)

		// Save initial state
		err := store.SaveWorkflowState(ctx, workflowID, initialState)
		if err != nil {
			t.Fatalf("failed to save initial state: %v", err)
		}

		// Update state (UPSERT behavior)
		err = store.SaveWorkflowState(ctx, workflowID, updatedState)
		if err != nil {
			t.Fatalf("failed to update state: %v", err)
		}

		// Verify updated state
		retrieved, err := store.GetWorkflowState(ctx, workflowID)
		if err != nil {
			t.Fatalf("failed to get updated state: %v", err)
		}

		if string(retrieved) != string(updatedState) {
			t.Errorf("expected updated state %s, got %s", updatedState, retrieved)
		}
	})

	t.Run("SaveAndGetNodeResult", func(t *testing.T) {
		workflowID := "test-workflow-3"
		nodeID := "http_request_1"
		result := []byte(`{"statusCode":200,"body":"OK"}`)

		// Save node result
		err := store.SaveNodeResult(ctx, workflowID, nodeID, result)
		if err != nil {
			t.Fatalf("failed to save node result: %v", err)
		}

		// Retrieve node result
		retrieved, err := store.GetNodeResult(ctx, workflowID, nodeID)
		if err != nil {
			t.Fatalf("failed to get node result: %v", err)
		}

		// Verify result matches
		if string(retrieved) != string(result) {
			t.Errorf("expected result %s, got %s", result, retrieved)
		}
	})

	t.Run("MultipleNodes", func(t *testing.T) {
		workflowID := "test-workflow-4"

		// Save results for multiple nodes
		nodes := map[string][]byte{
			"node_1": []byte(`{"output":"result1"}`),
			"node_2": []byte(`{"output":"result2"}`),
			"node_3": []byte(`{"output":"result3"}`),
		}

		for nodeID, result := range nodes {
			err := store.SaveNodeResult(ctx, workflowID, nodeID, result)
			if err != nil {
				t.Fatalf("failed to save node %s: %v", nodeID, err)
			}
		}

		// Verify all nodes can be retrieved
		for nodeID, expected := range nodes {
			retrieved, err := store.GetNodeResult(ctx, workflowID, nodeID)
			if err != nil {
				t.Fatalf("failed to get node %s: %v", nodeID, err)
			}

			if string(retrieved) != string(expected) {
				t.Errorf("node %s: expected %s, got %s", nodeID, expected, retrieved)
			}
		}
	})
}
