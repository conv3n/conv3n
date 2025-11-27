package engine

import (
	"context"
	"testing"
)

// TestCustomCodeSimple tests basic custom code execution
func TestCustomCodeSimple(t *testing.T) {
	runner := NewBunRunner("../../pkg/blocks")

	block := Block{
		ID:   "test_custom",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": `export default async (input) => { return { result: input.value * 2 }; }`,
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
		"input": map[string]interface{}{
			"value": 42,
		},
	}

	result, err := runner.ExecuteBlock(context.Background(), block, input)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Check result structure
	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map, got: %T", result)
	}

	// Verify port
	port, ok := resultMap["port"].(string)
	if !ok || port != "default" {
		t.Fatalf("Expected port=default, got: %v", resultMap["port"])
	}

	// Verify inner data
	dataMap, ok := resultMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data to be a map, got: %T", resultMap["data"])
	}

	// Verify success
	success, ok := dataMap["success"].(bool)
	if !ok || !success {
		t.Fatalf("Expected success=true, got: %v", dataMap)
	}

	// Verify actual data payload
	payload, ok := dataMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected payload to be a map, got: %T", dataMap["data"])
	}

	resultValue, ok := payload["result"].(float64)
	if !ok {
		t.Fatalf("Expected result to be a number, got: %T", payload["result"])
	}

	if resultValue != 84 {
		t.Errorf("Expected result=84, got: %v", resultValue)
	}
}

// TestCustomCodeSyntaxError tests handling of syntax errors
func TestCustomCodeSyntaxError(t *testing.T) {
	runner := NewBunRunner("../../pkg/blocks")

	block := Block{
		ID:   "test_syntax_error",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": `export default async (input) => { return { this is invalid syntax }; }`,
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
		"input":  map[string]interface{}{},
	}

	result, err := runner.ExecuteBlock(context.Background(), block, input)
	if err != nil {
		t.Fatalf("Expected no error from runner, got: %v", err)
	}

	// Check that the result indicates failure
	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map, got: %T", result)
	}

	// Verify port
	port, ok := resultMap["port"].(string)
	if !ok || port != "error" {
		t.Fatalf("Expected port=error, got: %v", resultMap["port"])
	}

	// Verify inner data
	dataMap, ok := resultMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data to be a map, got: %T", resultMap["data"])
	}

	success, ok := dataMap["success"].(bool)
	if !ok || success {
		t.Fatalf("Expected success=false for syntax error, got: %v", dataMap)
	}

	// Verify error details
	errorDetails, ok := dataMap["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected error details, got: %T", dataMap["error"])
	}

	errorType, ok := errorDetails["type"].(string)
	if !ok || errorType != "SyntaxError" {
		t.Errorf("Expected error type=SyntaxError, got: %v", errorType)
	}
}

// TestCustomCodeRuntimeError tests handling of runtime errors
func TestCustomCodeRuntimeError(t *testing.T) {
	runner := NewBunRunner("../../pkg/blocks")

	block := Block{
		ID:   "test_runtime_error",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": `export default async (input) => { throw new Error("Intentional error"); }`,
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
		"input":  map[string]interface{}{},
	}

	result, err := runner.ExecuteBlock(context.Background(), block, input)
	if err != nil {
		t.Fatalf("Expected no error from runner, got: %v", err)
	}

	// Check that the result indicates failure
	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map, got: %T", result)
	}

	// Verify port
	port, ok := resultMap["port"].(string)
	if !ok || port != "error" {
		t.Fatalf("Expected port=error, got: %v", resultMap["port"])
	}

	// Verify inner data
	dataMap, ok := resultMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data to be a map, got: %T", resultMap["data"])
	}

	success, ok := dataMap["success"].(bool)
	if !ok || success {
		t.Fatalf("Expected success=false for runtime error, got: %v", dataMap)
	}

	// Verify error details
	errorDetails, ok := dataMap["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected error details, got: %T", dataMap["error"])
	}

	message, ok := errorDetails["message"].(string)
	if !ok || message == "" {
		t.Errorf("Expected error message, got: %v", message)
	}
}

// TestCustomCodeAsync tests asynchronous code execution
func TestCustomCodeAsync(t *testing.T) {
	runner := NewBunRunner("../../pkg/blocks")

	block := Block{
		ID:   "test_async",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": `export default async (input) => { 
				await new Promise(resolve => setTimeout(resolve, 10));
				return { delayed: true, value: input.value };
			}`,
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
		"input": map[string]interface{}{
			"value": "test",
		},
	}

	result, err := runner.ExecuteBlock(context.Background(), block, input)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map, got: %T", result)
	}

	// Verify inner data
	dataMap, ok := resultMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data to be a map, got: %T", resultMap["data"])
	}

	success, ok := dataMap["success"].(bool)
	if !ok || !success {
		t.Fatalf("Expected success=true, got: %v", dataMap)
	}

	payload, ok := dataMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected payload to be a map, got: %T", dataMap["data"])
	}

	delayed, ok := payload["delayed"].(bool)
	if !ok || !delayed {
		t.Errorf("Expected delayed=true, got: %v", payload["delayed"])
	}
}

// TestCustomCodeObjectManipulation tests working with complex objects
func TestCustomCodeObjectManipulation(t *testing.T) {
	runner := NewBunRunner("../../pkg/blocks")

	block := Block{
		ID:   "test_objects",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"code": `export default async (input) => { 
				const items = input.items.map(item => ({ ...item, processed: true }));
				return { items, count: items.length };
			}`,
		},
	}

	input := map[string]interface{}{
		"config": block.Config,
		"input": map[string]interface{}{
			"items": []interface{}{
				map[string]interface{}{"id": 1, "name": "Item 1"},
				map[string]interface{}{"id": 2, "name": "Item 2"},
			},
		},
	}

	result, err := runner.ExecuteBlock(context.Background(), block, input)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map, got: %T", result)
	}

	// Verify inner data
	dataMap, ok := resultMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data to be a map, got: %T", resultMap["data"])
	}

	success, ok := dataMap["success"].(bool)
	if !ok || !success {
		t.Fatalf("Expected success=true, got: %v", dataMap)
	}

	payload, ok := dataMap["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected payload to be a map, got: %T", dataMap["data"])
	}

	count, ok := payload["count"].(float64)
	if !ok || count != 2 {
		t.Errorf("Expected count=2, got: %v", payload["count"])
	}
}
