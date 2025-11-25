package engine

import (
	"testing"
)

// TestNewStateManager verifies StateManager initialization
func TestNewStateManager(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	if sm == nil {
		t.Fatal("NewStateManager returned nil")
	}

	if sm.ctx != ctx {
		t.Error("StateManager context not set correctly")
	}
}

// TestSetResultAndGetResult verifies basic state storage and retrieval
func TestSetResultAndGetResult(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	// Test setting and getting a simple value
	blockID := "block1"
	expectedResult := map[string]interface{}{
		"status": 200,
		"data":   "test data",
	}

	sm.SetResult(blockID, expectedResult)
	actualResult := sm.GetResult(blockID)

	if actualResult == nil {
		t.Fatal("GetResult returned nil")
	}

	resultMap, ok := actualResult.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map[string]interface{}, got %T", actualResult)
	}

	if resultMap["status"] != 200 {
		t.Errorf("Expected status 200, got %v", resultMap["status"])
	}

	if resultMap["data"] != "test data" {
		t.Errorf("Expected 'test data', got %v", resultMap["data"])
	}
}

// TestGetResultNonExistent verifies behavior when getting non-existent result
func TestGetResultNonExistent(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	result := sm.GetResult("non-existent-block")
	if result != nil {
		t.Errorf("Expected nil for non-existent block, got %v", result)
	}
}

// TestPrepareInputSimple verifies input preparation without variables
func TestPrepareInputSimple(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	block := Block{
		ID:   "test-block",
		Type: BlockTypeHTTPRequest,
		Config: map[string]interface{}{
			"url":    "https://example.com",
			"method": "GET",
		},
	}

	input, err := sm.PrepareInput(block)
	if err != nil {
		t.Fatalf("PrepareInput failed: %v", err)
	}

	if input == nil {
		t.Fatal("PrepareInput returned nil")
	}

	config, ok := input["config"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected config to be map[string]interface{}, got %T", input["config"])
	}

	if config["url"] != "https://example.com" {
		t.Errorf("Expected url 'https://example.com', got %v", config["url"])
	}

	if config["method"] != "GET" {
		t.Errorf("Expected method 'GET', got %v", config["method"])
	}
}

// TestPrepareInputWithVariables verifies variable resolution in config
func TestPrepareInputWithVariables(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	// Set up previous block result
	sm.SetResult("previous-block", map[string]interface{}{
		"data": map[string]interface{}{
			"userId": 123,
			"name":   "John Doe",
		},
	})

	block := Block{
		ID:   "current-block",
		Type: BlockTypeHTTPRequest,
		Config: map[string]interface{}{
			"url":    "https://api.example.com/users/{{ $node.previous-block.data.userId }}",
			"method": "GET",
			"headers": map[string]interface{}{
				"X-User-Name": "{{ $node.previous-block.data.name }}",
			},
		},
	}

	input, err := sm.PrepareInput(block)
	if err != nil {
		t.Fatalf("PrepareInput failed: %v", err)
	}

	config, ok := input["config"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected config to be map[string]interface{}, got %T", input["config"])
	}

	expectedURL := "https://api.example.com/users/123"
	if config["url"] != expectedURL {
		t.Errorf("Expected url '%s', got %v", expectedURL, config["url"])
	}

	headers, ok := config["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected headers to be map[string]interface{}, got %T", config["headers"])
	}

	if headers["X-User-Name"] != "John Doe" {
		t.Errorf("Expected header 'John Doe', got %v", headers["X-User-Name"])
	}
}

// TestPrepareInputWithInvalidVariable verifies error handling for invalid variables
func TestPrepareInputWithInvalidVariable(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	block := Block{
		ID:   "test-block",
		Type: BlockTypeHTTPRequest,
		Config: map[string]interface{}{
			"url": "https://api.example.com/{{ $node.non-existent.data }}",
		},
	}

	_, err := sm.PrepareInput(block)
	if err == nil {
		t.Error("Expected error for non-existent variable, got nil")
	}
}

// TestMultipleBlockResults verifies handling multiple block results
func TestMultipleBlockResults(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")
	sm := NewStateManager(ctx)

	// Set multiple results
	sm.SetResult("block1", map[string]interface{}{"value": 1})
	sm.SetResult("block2", map[string]interface{}{"value": 2})
	sm.SetResult("block3", map[string]interface{}{"value": 3})

	// Verify all results are stored
	if sm.GetResult("block1").(map[string]interface{})["value"] != 1 {
		t.Error("block1 result incorrect")
	}
	if sm.GetResult("block2").(map[string]interface{})["value"] != 2 {
		t.Error("block2 result incorrect")
	}
	if sm.GetResult("block3").(map[string]interface{})["value"] != 3 {
		t.Error("block3 result incorrect")
	}
}
