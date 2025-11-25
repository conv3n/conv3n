package engine

import (
	"context"
	"fmt"
	"log"
)

// WorkflowRunner orchestrates the execution of a workflow.
type WorkflowRunner struct {
	bunRunner    *BunRunner
	stateManager *StateManager
}

// NewWorkflowRunner creates a new runner for a specific execution context.
func NewWorkflowRunner(ctx *ExecutionContext, blocksDir string) *WorkflowRunner {
	return &WorkflowRunner{
		bunRunner:    NewBunRunner(blocksDir),
		stateManager: NewStateManager(ctx),
	}
}

// Run executes the workflow.
// For the MVP, we assume a linear execution order based on the Blocks array order.
// TODO: Implement topological sort for DAG execution.
func (wr *WorkflowRunner) Run(ctx context.Context, workflow Workflow) error {
	log.Printf("Starting workflow: %s (%s)", workflow.Name, workflow.ID)

	for _, block := range workflow.Blocks {
		log.Printf("Executing block: %s (%s)", block.ID, block.Type)

		// 1. Prepare Input (Resolve variables)
		input, err := wr.stateManager.PrepareInput(block)
		if err != nil {
			return fmt.Errorf("failed to prepare input for block %s: %w", block.ID, err)
		}

		// 2. Execute Block
		result, err := wr.bunRunner.ExecuteBlock(ctx, block, input)
		if err != nil {
			return fmt.Errorf("failed to execute block %s: %w", block.ID, err)
		}

		// 3. Save Result
		wr.stateManager.SetResult(block.ID, result)
		log.Printf("Block %s completed successfully", block.ID)
	}

	log.Printf("Workflow %s completed", workflow.ID)
	return nil
}
