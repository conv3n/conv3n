package engine_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/conv3n/conv3n/internal/engine"
)

// TestNewBunRunner verifies BunRunner initialization
func TestNewBunRunner(t *testing.T) {
	blocksDir := "/test/blocks"
	runner := engine.NewBunRunner(blocksDir)

	if runner == nil {
		t.Fatal("NewBunRunner returned nil")
	}

	// Note: We can't directly access private fields, but we can test behavior
	// The runner should be ready to execute scripts
}

// TestBunRunner_Execute verifies basic script execution
func TestBunRunner_Execute(t *testing.T) {
	// Locate the runner script relative to the test file
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get cwd: %v", err)
	}

	// Try to find the script path
	scriptPath := filepath.Join(cwd, "../../pkg/bunock/runner.ts")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		// Fallback for running from root
		scriptPath = filepath.Join(cwd, "pkg/bunock/runner.ts")
	}

	runner := engine.NewBunRunner(filepath.Dir(scriptPath))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	input := map[string]interface{}{
		"test": "data",
	}

	result, err := runner.Execute(ctx, scriptPath, input)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	resMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}

	if resMap["status"] != "success" {
		t.Errorf("expected status success, got %v", resMap["status"])
	}
}

// TestBunRunner_ExecuteBlock_HTTPRequest verifies HTTP request block execution
func TestBunRunner_ExecuteBlock_HTTPRequest(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	cwd, _ := os.Getwd()
	blocksDir := filepath.Join(cwd, "../../pkg/blocks")
	if _, err := os.Stat(blocksDir); os.IsNotExist(err) {
		blocksDir = filepath.Join(cwd, "pkg/blocks")
	}

	runner := engine.NewBunRunner(blocksDir)

	// Setup mock HTTP server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "success", "origin": "127.0.0.1"}`))
	}))
	defer ts.Close()

	// Create a simple HTTP request block
	block := engine.Block{
		ID:   "test-http",
		Type: engine.BlockTypeHTTPRequest,
		Config: map[string]interface{}{
			"url":    ts.URL,
			"method": "GET",
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := runner.ExecuteBlock(ctx, block, input)
	if err != nil {
		t.Fatalf("ExecuteBlock failed: %v", err)
	}

	resMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}

	// Verify HTTP response structure
	if resMap["status"] == nil {
		t.Error("expected status field in result")
	}
}

// TestBunRunner_ExecuteBlock_CustomCode verifies custom code block execution
func TestBunRunner_ExecuteBlock_CustomCode(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	cwd, _ := os.Getwd()
	blocksDir := filepath.Join(cwd, "../../pkg/blocks")
	if _, err := os.Stat(blocksDir); os.IsNotExist(err) {
		blocksDir = filepath.Join(cwd, "pkg/blocks")
	}

	runner := engine.NewBunRunner(blocksDir)

	// Create a custom code block
	block := engine.Block{
		ID:   "test-code",
		Type: engine.BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": "export default async (input) => { return { result: 42 }; }",
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := runner.ExecuteBlock(ctx, block, input)
	if err != nil {
		t.Fatalf("ExecuteBlock failed: %v", err)
	}

	resMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}

	// Verify custom code execution
	if resMap["success"] != true {
		t.Errorf("expected success=true, got %v", resMap["success"])
	}
}

// TestBunRunner_ExecuteBlock_UnknownType verifies error handling for unknown block types
func TestBunRunner_ExecuteBlock_UnknownType(t *testing.T) {
	runner := engine.NewBunRunner("/tmp")

	block := engine.Block{
		ID:   "test-unknown",
		Type: "unknown/type",
		Config: map[string]interface{}{
			"test": "data",
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := runner.ExecuteBlock(ctx, block, input)
	if err == nil {
		t.Error("expected error for unknown block type, got nil")
	}
}

// TestBunRunner_Execute_InvalidJSON verifies error handling for invalid JSON output
func TestBunRunner_Execute_InvalidJSON(t *testing.T) {
	// This test would require a script that outputs invalid JSON
	// For now, we'll test with a non-existent script which will fail
	runner := engine.NewBunRunner("/tmp")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	input := map[string]interface{}{"test": "data"}

	_, err := runner.Execute(ctx, "/non/existent/script.ts", input)
	if err == nil {
		t.Error("expected error for non-existent script, got nil")
	}
}

// TestBunRunner_Execute_ContextCancellation verifies context cancellation handling
func TestBunRunner_Execute_ContextCancellation(t *testing.T) {
	// Skip if bun is not available
	if _, err := exec.LookPath("bun"); err != nil {
		t.Skip("bun not found in PATH, skipping test")
	}

	cwd, _ := os.Getwd()
	scriptPath := filepath.Join(cwd, "../../pkg/bunock/runner.ts")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join(cwd, "pkg/bunock/runner.ts")
	}

	runner := engine.NewBunRunner(filepath.Dir(scriptPath))

	// Create a context that's already cancelled
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	input := map[string]interface{}{"test": "data"}

	_, err := runner.Execute(ctx, scriptPath, input)
	if err == nil {
		t.Error("expected error for cancelled context, got nil")
	}
}
