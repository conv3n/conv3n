package engine_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/conv3n/conv3n/internal/engine"
)

func TestBunRunner_Execute(t *testing.T) {
	// Locate the runner script relative to the test file
	// Assuming test is run from project root or we can find the file
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get cwd: %v", err)
	}

	// Adjust path based on where the test is running.
	// If running from root: pkg/bunock/runner.ts
	// If running from internal/engine: ../../pkg/bunock/runner.ts
	// For simplicity, we assume running from root via `go test ./...`
	// But to be safe, let's try to find it.
	scriptPath := filepath.Join(cwd, "../../pkg/bunock/runner.ts")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		// Fallback for running from root
		scriptPath = filepath.Join(cwd, "pkg/bunock/runner.ts")
	}

	runner := engine.NewBunRunner()

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
