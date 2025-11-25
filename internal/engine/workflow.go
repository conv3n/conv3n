package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/conv3n/conv3n/internal/storage"
)

// WorkflowRunner orchestrates the execution of a workflow.
type WorkflowRunner struct {
	bunRunner    *BunRunner
	stateManager *StateManager
	storage      storage.Storage
}

// NewWorkflowRunner creates a new runner for a specific execution context.
func NewWorkflowRunner(ctx *ExecutionContext, blocksDir string, store storage.Storage) *WorkflowRunner {
	return &WorkflowRunner{
		bunRunner:    NewBunRunner(blocksDir),
		stateManager: NewStateManager(ctx),
		storage:      store,
	}
}

// Run executes the workflow.
// For the MVP, we assume a linear execution order based on the Blocks array order.
// TODO: Implement topological sort for DAG execution.
func (wr *WorkflowRunner) Run(ctx context.Context, workflow Workflow) error {
	log.Printf("Starting workflow: %s (%s)", workflow.Name, workflow.ID)

	// 1. Create execution record
	execID, err := wr.storage.CreateExecution(ctx, workflow.ID)
	if err != nil {
		return fmt.Errorf("failed to create execution record: %w", err)
	}

	var finalStatus = storage.ExecutionStatusCompleted
	var finalError *string

	defer func() {
		// Update final status
		// TODO: Collect full state if needed
		if err := wr.storage.UpdateExecutionStatus(ctx, execID, finalStatus, []byte("{}"), finalError); err != nil {
			log.Printf("Failed to update execution status: %v", err)
		}
	}()

	for _, block := range workflow.Blocks {
		log.Printf("Executing block: %s (%s)", block.ID, block.Type)

		// 1. Prepare Input (Resolve variables)
		input, err := wr.stateManager.PrepareInput(block)
		if err != nil {
			finalStatus = storage.ExecutionStatusFailed
			msg := err.Error()
			finalError = &msg
			return fmt.Errorf("failed to prepare input for block %s: %w", block.ID, err)
		}

		// 2. Execute Block
		result, err := wr.bunRunner.ExecuteBlock(ctx, block, input)
		if err != nil {
			finalStatus = storage.ExecutionStatusFailed
			msg := err.Error()
			finalError = &msg
			return fmt.Errorf("failed to execute block %s: %w", block.ID, err)
		}

		// 3. Save Result
		// Save to DB
		resBytes, _ := json.Marshal(result)
		if err := wr.storage.SaveNodeResult(ctx, execID, block.ID, resBytes); err != nil {
			log.Printf("Warning: failed to save node result: %v", err)
		}

		// Save to memory state
		wr.stateManager.SetResult(block.ID, result)
		log.Printf("Block %s completed successfully", block.ID)
	}

	log.Printf("Workflow %s completed", workflow.ID)
	return nil
}
