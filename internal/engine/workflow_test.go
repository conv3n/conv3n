package engine_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/conv3n/conv3n/internal/engine"
	"github.com/conv3n/conv3n/internal/storage"
)

func createTestStorage(t *testing.T) storage.Storage {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewSQLite(dbPath)
	if err != nil {
		t.Fatalf("Failed to create test storage: %v", err)
	}
	// Note: We don't close store here because it needs to be used by the runner.
	// In a real test we might want to ensure it's closed, but for these unit tests
	// relying on t.TempDir cleanup is sufficient for the file, though closing connections is better.
	t.Cleanup(func() {
		store.Close()
	})
	return store
}

// TestNewWorkflowRunner verifies WorkflowRunner initialization
func TestNewWorkflowRunner(t *testing.T) {
	ctx := engine.NewExecutionContext("test-workflow")
	blocksDir := "/test/blocks"
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, blocksDir, store)

	if runner == nil {
		t.Fatal("NewWorkflowRunner returned nil")
	}
}

// TestWorkflowRunner_Run_EmptyWorkflow verifies handling of empty workflow
func TestWorkflowRunner_Run_EmptyWorkflow(t *testing.T) {
	workflow := engine.Workflow{
		ID:          "empty-wf",
		Name:        "Empty Workflow",
		Blocks:      []engine.Block{},
		Connections: []engine.Connection{},
	}

	ctx := engine.NewExecutionContext(workflow.ID)
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, "/tmp", store)

	execCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := runner.Run(execCtx, workflow)
	if err != nil {
		t.Errorf("Empty workflow should not fail, got error: %v", err)
	}
}

// TestWorkflowRunner_Run_SingleBlock verifies single block execution
func TestWorkflowRunner_Run_SingleBlock(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	// Setup mock HTTP server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "success"}`))
	}))
	defer ts.Close()

	workflow := engine.Workflow{
		ID:   "single-block-wf",
		Name: "Single Block Workflow",
		Blocks: []engine.Block{
			{
				ID:   "http-block",
				Type: engine.BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					"url":    ts.URL,
					"method": "GET",
				},
			},
		},
	}

	// Change to project root
	wd, _ := os.Getwd()
	os.Chdir("../..")
	defer os.Chdir(wd)

	ctx := engine.NewExecutionContext(workflow.ID)
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, "pkg/blocks", store)

	execCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := runner.Run(execCtx, workflow)
	if err != nil {
		t.Fatalf("Workflow execution failed: %v", err)
	}

	// Verify result
	result := ctx.Results["http-block"]
	if result == nil {
		t.Fatal("Expected result for http-block, got nil")
	}
}

func TestWorkflowRunner_Run_Chain(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	// 1. Setup Mock HTTP Server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := `{"message": "hello from api", "value": 100}`
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, body)
	}))
	defer ts.Close()

	// 2. Define Workflow
	workflow := engine.Workflow{
		ID:   "wf-test-1",
		Name: "Test Chain",
		Blocks: []engine.Block{
			{
				ID:   "block_1",
				Type: engine.BlockTypeHTTPRequest,
				Config: engine.BlockConfig{
					"url":    ts.URL,
					"method": "GET",
				},
			},
			{
				ID:   "block_2",
				Type: engine.BlockTypeHTTPRequest,
				Config: engine.BlockConfig{
					// Variable substitution test
					"url":    ts.URL + "?prev_value={{ $node.block_1.data.value }}",
					"method": "GET",
				},
			},
		},
	}

	// 3. Run Workflow
	wd, _ := os.Getwd()
	os.Chdir("../..")
	defer os.Chdir(wd)

	blocksDir := "pkg/blocks"

	ctx := engine.NewExecutionContext(workflow.ID)
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, blocksDir, store)

	execCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := runner.Run(execCtx, workflow); err != nil {
		t.Fatalf("Workflow execution failed: %v", err)
	}

	// 4. Verify Results
	res1 := ctx.Results["block_1"]
	if res1 == nil {
		t.Fatal("Block 1 result missing")
	}

	res2 := ctx.Results["block_2"]
	if res2 == nil {
		t.Fatal("Block 2 result missing")
	}

	// Debug: print structure to understand the issue
	t.Logf("Block 1 result type: %T, value: %+v", res1, res1)
	
	// Check variable substitution worked
	resMap1, ok := res1.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected block 1 result to be map, got %T", res1)
	}
	
	t.Logf("Block 1 data field type: %T, value: %+v", resMap1["data"], resMap1["data"])
	
	data1, ok := resMap1["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected block 1 data to be map, got %T: %v", resMap1["data"], resMap1["data"])
	}
	
	if data1["value"].(float64) != 100 {
		t.Errorf("Expected block 1 value 100, got %v", data1["value"])
	}
}

// TestWorkflowRunner_Run_ErrorInBlock verifies error handling during block execution
func TestWorkflowRunner_Run_ErrorInBlock(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	workflow := engine.Workflow{
		ID:   "error-wf",
		Name: "Error Workflow",
		Blocks: []engine.Block{
			{
				ID:   "bad-block",
				Type: engine.BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					// Missing required 'url' field
					"method": "GET",
				},
			},
		},
	}

	wd, _ := os.Getwd()
	os.Chdir("../..")
	defer os.Chdir(wd)

	ctx := engine.NewExecutionContext(workflow.ID)
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, "pkg/blocks", store)

	execCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := runner.Run(execCtx, workflow)
	if err == nil {
		t.Error("Expected error for block with missing config, got nil")
	}
}

// TestWorkflowRunner_Run_SequentialExecution verifies blocks execute in order
func TestWorkflowRunner_Run_SequentialExecution(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	callOrder := []string{}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		blockID := r.URL.Query().Get("block")
		callOrder = append(callOrder, blockID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok": true}`))
	}))
	defer ts.Close()

	workflow := engine.Workflow{
		ID:   "sequential-wf",
		Name: "Sequential Workflow",
		Blocks: []engine.Block{
			{
				ID:   "block-1",
				Type: engine.BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					"url":    ts.URL + "?block=1",
					"method": "GET",
				},
			},
			{
				ID:   "block-2",
				Type: engine.BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					"url":    ts.URL + "?block=2",
					"method": "GET",
				},
			},
			{
				ID:   "block-3",
				Type: engine.BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					"url":    ts.URL + "?block=3",
					"method": "GET",
				},
			},
		},
	}

	wd, _ := os.Getwd()
	os.Chdir("../..")
	defer os.Chdir(wd)

	ctx := engine.NewExecutionContext(workflow.ID)
	store := createTestStorage(t)
	runner := engine.NewWorkflowRunner(ctx, "pkg/blocks", store)

	execCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := runner.Run(execCtx, workflow)
	if err != nil {
		t.Fatalf("Workflow execution failed: %v", err)
	}

	// Verify execution order
	expectedOrder := []string{"1", "2", "3"}
	if len(callOrder) != len(expectedOrder) {
		t.Fatalf("Expected %d calls, got %d", len(expectedOrder), len(callOrder))
	}

	for i, expected := range expectedOrder {
		if callOrder[i] != expected {
			t.Errorf("Call %d: expected block %s, got %s", i, expected, callOrder[i])
		}
	}
}
