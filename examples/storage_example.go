package main

import (
	"context"
	"fmt"
	"log"

	"github.com/conv3n/conv3n/internal/storage"
)

func main() {
	// Create SQLite storage
	store, err := storage.NewSQLite("./conv3n.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	// Example 1: Save workflow state
	workflowID := "example-workflow-001"
	state := []byte(`{"status":"running","currentNode":"http_request_1"}`)

	err = store.SaveWorkflowState(ctx, workflowID, state)
	if err != nil {
		log.Fatalf("Failed to save workflow state: %v", err)
	}
	fmt.Println("✅ Workflow state saved")

	// Example 2: Retrieve workflow state
	retrievedState, err := store.GetWorkflowState(ctx, workflowID)
	if err != nil {
		log.Fatalf("Failed to get workflow state: %v", err)
	}
	fmt.Printf("📦 Retrieved state: %s\n", retrievedState)

	// Example 3: Save node results
	nodeResults := map[string][]byte{
		"http_request_1": []byte(`{"statusCode":200,"body":"Success"}`),
		"transform_1":    []byte(`{"output":{"userId":123,"name":"John"}}`),
		"condition_1":    []byte(`{"branch":"success","result":true}`),
	}

	for nodeID, result := range nodeResults {
		err = store.SaveNodeResult(ctx, workflowID, nodeID, result)
		if err != nil {
			log.Fatalf("Failed to save node %s result: %v", nodeID, err)
		}
		fmt.Printf("✅ Node %s result saved\n", nodeID)
	}

	// Example 4: Retrieve specific node result
	nodeResult, err := store.GetNodeResult(ctx, workflowID, "http_request_1")
	if err != nil {
		log.Fatalf("Failed to get node result: %v", err)
	}
	fmt.Printf("📦 Node result: %s\n", nodeResult)

	fmt.Println("\n🎉 Storage example completed successfully!")
	fmt.Println("💡 Database file created at: ./conv3n.db")
	fmt.Println("💡 You can inspect it with: sqlite3 conv3n.db")
}
