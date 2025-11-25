package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
)

// BunRunner manages the execution of Bun scripts via OS subprocesses.
type BunRunner struct {
	// RuntimePath is the path to the bun executable (usually "bun").
	RuntimePath string
	// BlocksDir is the base directory where block scripts are located.
	BlocksDir string
}

// NewBunRunner creates a new runner instance.
func NewBunRunner(blocksDir string) *BunRunner {
	return &BunRunner{
		RuntimePath: "bun",
		BlocksDir:   blocksDir,
	}
}

// Execute runs the configured Bun script with the provided input payload.
// It writes the input to the subprocess's Stdin and reads the result from Stdout.
func (r *BunRunner) Execute(ctx context.Context, scriptPath string, input any) (any, error) {
	// Prepare the command: bun run <script>
	cmd := exec.CommandContext(ctx, r.RuntimePath, "run", scriptPath)

	// Setup pipes
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Start the process
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start bun process: %w", err)
	}

	// Write input JSON to stdin
	// We run this in a goroutine to avoid deadlocks if the buffer fills up
	go func() {
		defer stdin.Close()
		if err := json.NewEncoder(stdin).Encode(input); err != nil {
			// In a real app, we might want to log this or handle it better
		}
	}()

	// Wait for the process to finish
	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("bun execution failed: %v, stderr: %s", err, stderr.String())
	}

	// Parse the output JSON
	var result any
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return nil, fmt.Errorf("failed to parse bun output: %w, raw output: %s, stderr: %s", err, stdout.String(), stderr.String())
	}

	return result, nil
}

// ExecuteBlock executes a specific block using the appropriate template.
func (r *BunRunner) ExecuteBlock(ctx context.Context, block Block, input any) (any, error) {
	var scriptPath string

	// Determine script path based on block type
	switch block.Type {
	case BlockTypeHTTPRequest:
		// Use filepath.Join with the configured BlocksDir
		scriptPath = filepath.Join(r.BlocksDir, "std", "http_request.ts")
	case BlockTypeCustomCode:
		// For custom code, we might use a generic runner that evals the code
		return nil, fmt.Errorf("custom code not implemented yet")
	default:
		return nil, fmt.Errorf("unknown block type: %s", block.Type)
	}

	return r.Execute(ctx, scriptPath, input)
}
