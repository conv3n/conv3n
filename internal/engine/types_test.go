package engine

import (
	"encoding/json"
	"testing"
)

// TestNewExecutionContext verifies ExecutionContext initialization
func TestNewExecutionContext(t *testing.T) {
	workflowID := "test-workflow-123"
	ctx := NewExecutionContext(workflowID)

	if ctx == nil {
		t.Fatal("NewExecutionContext returned nil")
	}

	if ctx.WorkflowID != workflowID {
		t.Errorf("Expected WorkflowID %s, got %s", workflowID, ctx.WorkflowID)
	}

	if ctx.Results == nil {
		t.Error("Results map not initialized")
	}

	if len(ctx.Results) != 0 {
		t.Errorf("Expected empty Results map, got %d items", len(ctx.Results))
	}
}

// TestBlockTypesConstants verifies BlockType constants
func TestBlockTypesConstants(t *testing.T) {
	tests := []struct {
		name      string
		blockType BlockType
		expected  string
	}{
		{"HTTP Request", BlockTypeHTTPRequest, "std/http_request"},
		{"Custom Code", BlockTypeCustomCode, "custom/code"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.blockType) != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, string(tt.blockType))
			}
		})
	}
}

// TestBlockJSONSerialization verifies Block JSON marshaling/unmarshaling
func TestBlockJSONSerialization(t *testing.T) {
	original := Block{
		ID:   "test-block-1",
		Type: BlockTypeHTTPRequest,
		Config: map[string]interface{}{
			"url":    "https://api.example.com",
			"method": "POST",
			"headers": map[string]interface{}{
				"Content-Type": "application/json",
			},
		},
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal Block: %v", err)
	}

	// Unmarshal back
	var decoded Block
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal Block: %v", err)
	}

	// Verify fields
	if decoded.ID != original.ID {
		t.Errorf("Expected ID %s, got %s", original.ID, decoded.ID)
	}

	if decoded.Type != original.Type {
		t.Errorf("Expected Type %s, got %s", original.Type, decoded.Type)
	}

	if decoded.Config["url"] != original.Config["url"] {
		t.Errorf("Expected url %s, got %s", original.Config["url"], decoded.Config["url"])
	}
}

// TestBlockWithCustomCode verifies Block with Code field
func TestBlockWithCustomCode(t *testing.T) {
	block := Block{
		ID:   "custom-block",
		Type: BlockTypeCustomCode,
		Config: map[string]interface{}{
			"timeout": 5000,
		},
		Code: "export default async (input) => { return { result: input.value * 2 }; }",
	}

	jsonData, err := json.Marshal(block)
	if err != nil {
		t.Fatalf("Failed to marshal Block with Code: %v", err)
	}

	var decoded Block
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal Block with Code: %v", err)
	}

	if decoded.Code != block.Code {
		t.Errorf("Code field not preserved during serialization")
	}
}

// TestConnectionJSONSerialization verifies Connection JSON marshaling/unmarshaling
func TestConnectionJSONSerialization(t *testing.T) {
	original := Connection{
		From: "block-a",
		To:   "block-b",
	}

	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal Connection: %v", err)
	}

	var decoded Connection
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal Connection: %v", err)
	}

	if decoded.From != original.From {
		t.Errorf("Expected From %s, got %s", original.From, decoded.From)
	}

	if decoded.To != original.To {
		t.Errorf("Expected To %s, got %s", original.To, decoded.To)
	}
}

// TestWorkflowJSONSerialization verifies Workflow JSON marshaling/unmarshaling
func TestWorkflowJSONSerialization(t *testing.T) {
	original := Workflow{
		ID:   "workflow-123",
		Name: "Test Workflow",
		Nodes: map[string]Node{
			"node-1": {
				ID:   "node-1",
				Type: NodeTypeHTTPRequest,
				Position: Position{X: 0, Y: 100},
				Config: map[string]interface{}{
					"url": "https://api.example.com",
				},
			},
			"node-2": {
				ID:   "node-2",
				Type: NodeTypeCustomCode,
				Position: Position{X: 250, Y: 100},
				Config: map[string]interface{}{
					"input": "{{ $node.node-1.data }}",
				},
			},
		},
		Edges: []Edge{
			{ID: "e1", Source: "node-1", Target: "node-2", SourceHandle: "default", TargetHandle: "main"},
		},
	}

	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal Workflow: %v", err)
	}

	var decoded Workflow
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal Workflow: %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("Expected ID %s, got %s", original.ID, decoded.ID)
	}

	if decoded.Name != original.Name {
		t.Errorf("Expected Name %s, got %s", original.Name, decoded.Name)
	}

	if len(decoded.Nodes) != len(original.Nodes) {
		t.Errorf("Expected %d nodes, got %d", len(original.Nodes), len(decoded.Nodes))
	}

	if len(decoded.Edges) != len(original.Edges) {
		t.Errorf("Expected %d edges, got %d", len(original.Edges), len(decoded.Edges))
	}
}

// TestLegacyWorkflowJSONSerialization verifies legacy Workflow format
func TestLegacyWorkflowJSONSerialization(t *testing.T) {
	original := LegacyWorkflow{
		ID:   "workflow-123",
		Name: "Test Workflow",
		Blocks: []Block{
			{
				ID:   "block-1",
				Type: BlockTypeHTTPRequest,
				Config: map[string]interface{}{
					"url": "https://api.example.com",
				},
			},
			{
				ID:   "block-2",
				Type: BlockTypeCustomCode,
				Config: map[string]interface{}{
					"input": "{{ $node.block-1.data }}",
				},
				Code: "export default async (input) => input;",
			},
		},
		Connections: []Connection{
			{From: "block-1", To: "block-2"},
		},
	}

	jsonData, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal LegacyWorkflow: %v", err)
	}

	var decoded LegacyWorkflow
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal LegacyWorkflow: %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("Expected ID %s, got %s", original.ID, decoded.ID)
	}

	if len(decoded.Blocks) != len(original.Blocks) {
		t.Errorf("Expected %d blocks, got %d", len(original.Blocks), len(decoded.Blocks))
	}

	// Test conversion to graph format
	graphWorkflow := original.ToGraphWorkflow()
	if len(graphWorkflow.Nodes) != 2 {
		t.Errorf("Expected 2 nodes after conversion, got %d", len(graphWorkflow.Nodes))
	}
	if len(graphWorkflow.Edges) != 1 {
		t.Errorf("Expected 1 edge after conversion, got %d", len(graphWorkflow.Edges))
	}
}

// TestExecutionContextResultsManipulation verifies Results map operations
func TestExecutionContextResultsManipulation(t *testing.T) {
	ctx := NewExecutionContext("test-workflow")

	// Add results
	ctx.Results["block1"] = map[string]interface{}{"value": 1}
	ctx.Results["block2"] = map[string]interface{}{"value": 2}

	if len(ctx.Results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(ctx.Results))
	}

	// Verify retrieval
	result1 := ctx.Results["block1"].(map[string]interface{})
	if result1["value"] != 1 {
		t.Errorf("Expected value 1, got %v", result1["value"])
	}

	// Update result
	ctx.Results["block1"] = map[string]interface{}{"value": 100}
	updatedResult := ctx.Results["block1"].(map[string]interface{})
	if updatedResult["value"] != 100 {
		t.Errorf("Expected updated value 100, got %v", updatedResult["value"])
	}
}

// TestBlockConfigTypes verifies node config can hold various types
func TestBlockConfigTypes(t *testing.T) {
	config := map[string]interface{}{
		"string":  "value",
		"number":  42,
		"float":   3.14,
		"boolean": true,
		"array":   []interface{}{1, 2, 3},
		"object": map[string]interface{}{
			"nested": "data",
		},
		"null": nil,
	}

	block := Block{
		ID:     "test",
		Type:   BlockTypeHTTPRequest,
		Config: config,
	}

	// Verify all types are preserved
	if block.Config["string"] != "value" {
		t.Error("String type not preserved")
	}
	if block.Config["number"] != 42 {
		t.Error("Number type not preserved")
	}
	if block.Config["float"] != 3.14 {
		t.Error("Float type not preserved")
	}
	if block.Config["boolean"] != true {
		t.Error("Boolean type not preserved")
	}
	if block.Config["null"] != nil {
		t.Error("Null type not preserved")
	}
}

// TestEmptyWorkflow verifies empty workflow handling
func TestEmptyWorkflow(t *testing.T) {
	workflow := Workflow{
		ID:    "empty-workflow",
		Name:  "Empty",
		Nodes: map[string]Node{},
		Edges: []Edge{},
	}

	jsonData, err := json.Marshal(workflow)
	if err != nil {
		t.Fatalf("Failed to marshal empty workflow: %v", err)
	}

	var decoded Workflow
	err = json.Unmarshal(jsonData, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal empty workflow: %v", err)
	}

	if len(decoded.Nodes) != 0 {
		t.Errorf("Expected 0 nodes, got %d", len(decoded.Nodes))
	}

	if len(decoded.Edges) != 0 {
		t.Errorf("Expected 0 edges, got %d", len(decoded.Edges))
	}
}
