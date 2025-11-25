package engine

import (
	"reflect"
	"testing"
)

// TestResolveVariablesString verifies string variable resolution
func TestResolveVariablesString(t *testing.T) {
	state := map[string]interface{}{
		"block1": map[string]interface{}{
			"data": map[string]interface{}{
				"name": "Alice",
			},
		},
	}

	tests := []struct {
		name     string
		input    string
		expected interface{}
		wantErr  bool
	}{
		{
			name:     "simple variable replacement",
			input:    "{{ $node.block1.data.name }}",
			expected: "Alice",
			wantErr:  false,
		},
		{
			name:     "string interpolation",
			input:    "Hello {{ $node.block1.data.name }}!",
			expected: "Hello Alice!",
			wantErr:  false,
		},
		{
			name:     "no variables",
			input:    "plain text",
			expected: "plain text",
			wantErr:  false,
		},
		{
			name:     "non-existent path",
			input:    "{{ $node.block1.data.missing }}",
			expected: nil,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ResolveVariables(tt.input, state)
			if (err != nil) != tt.wantErr {
				t.Errorf("ResolveVariables() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("ResolveVariables() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestResolveVariablesObject verifies object variable resolution
func TestResolveVariablesObject(t *testing.T) {
	state := map[string]interface{}{
		"api_response": map[string]interface{}{
			"data": map[string]interface{}{
				"userId": 42,
				"email":  "test@example.com",
			},
		},
	}

	input := map[string]interface{}{
		"url":    "https://api.example.com/users/{{ $node.api_response.data.userId }}",
		"method": "GET",
		"headers": map[string]interface{}{
			"X-User-Email": "{{ $node.api_response.data.email }}",
		},
	}

	result, err := ResolveVariables(input, state)
	if err != nil {
		t.Fatalf("ResolveVariables() error = %v", err)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map[string]interface{}, got %T", result)
	}

	if resultMap["url"] != "https://api.example.com/users/42" {
		t.Errorf("Expected url with resolved userId, got %v", resultMap["url"])
	}

	headers := resultMap["headers"].(map[string]interface{})
	if headers["X-User-Email"] != "test@example.com" {
		t.Errorf("Expected resolved email, got %v", headers["X-User-Email"])
	}
}

// TestResolveVariablesArray verifies array variable resolution
func TestResolveVariablesArray(t *testing.T) {
	state := map[string]interface{}{
		"block1": map[string]interface{}{
			"data": map[string]interface{}{
				"value": 100,
			},
		},
	}

	input := []interface{}{
		"static value",
		"{{ $node.block1.data.value }}",
		map[string]interface{}{
			"nested": "{{ $node.block1.data.value }}",
		},
	}

	result, err := ResolveVariables(input, state)
	if err != nil {
		t.Fatalf("ResolveVariables() error = %v", err)
	}

	resultSlice, ok := result.([]interface{})
	if !ok {
		t.Fatalf("Expected []interface{}, got %T", result)
	}

	if len(resultSlice) != 3 {
		t.Fatalf("Expected 3 elements, got %d", len(resultSlice))
	}

	if resultSlice[0] != "static value" {
		t.Errorf("Expected 'static value', got %v", resultSlice[0])
	}

	if resultSlice[1] != 100 {
		t.Errorf("Expected 100, got %v", resultSlice[1])
	}

	nestedMap := resultSlice[2].(map[string]interface{})
	if nestedMap["nested"] != 100 {
		t.Errorf("Expected nested value 100, got %v", nestedMap["nested"])
	}
}

// TestResolveVariablesPrimitives verifies primitive types pass through unchanged
func TestResolveVariablesPrimitives(t *testing.T) {
	state := map[string]interface{}{}

	tests := []struct {
		name  string
		input interface{}
	}{
		{"integer", 42},
		{"float", 3.14},
		{"boolean true", true},
		{"boolean false", false},
		{"nil", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ResolveVariables(tt.input, state)
			if err != nil {
				t.Errorf("ResolveVariables() error = %v", err)
			}
			if !reflect.DeepEqual(result, tt.input) {
				t.Errorf("ResolveVariables() = %v, want %v", result, tt.input)
			}
		})
	}
}

// TestGetValueByPath verifies path traversal logic
func TestGetValueByPath(t *testing.T) {
	state := map[string]interface{}{
		"block1": map[string]interface{}{
			"data": map[string]interface{}{
				"user": map[string]interface{}{
					"name": "Bob",
					"age":  30,
				},
				"count": 5,
			},
			"status": "success",
		},
	}

	tests := []struct {
		name     string
		path     string
		expected interface{}
		wantErr  bool
	}{
		{
			name:     "simple path",
			path:     "$node.block1.status",
			expected: "success",
			wantErr:  false,
		},
		{
			name:     "nested path",
			path:     "$node.block1.data.user.name",
			expected: "Bob",
			wantErr:  false,
		},
		{
			name:     "path without $node prefix",
			path:     "block1.data.count",
			expected: 5,
			wantErr:  false,
		},
		{
			name:     "non-existent key",
			path:     "$node.block1.data.missing",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "non-existent block",
			path:     "$node.missing_block.data",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "traversing non-map",
			path:     "$node.block1.status.invalid",
			expected: nil,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := getValueByPath(tt.path, state)
			if (err != nil) != tt.wantErr {
				t.Errorf("getValueByPath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("getValueByPath() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestResolveVariablesTypePreservation verifies type preservation for full variable replacement
func TestResolveVariablesTypePreservation(t *testing.T) {
	state := map[string]interface{}{
		"block1": map[string]interface{}{
			"data": map[string]interface{}{
				"number": 42,
				"object": map[string]interface{}{
					"key": "value",
				},
				"array": []interface{}{1, 2, 3},
			},
		},
	}

	tests := []struct {
		name     string
		input    string
		expected interface{}
	}{
		{
			name:     "number preservation",
			input:    "{{ $node.block1.data.number }}",
			expected: 42,
		},
		{
			name:  "object preservation",
			input: "{{ $node.block1.data.object }}",
			expected: map[string]interface{}{
				"key": "value",
			},
		},
		{
			name:     "array preservation",
			input:    "{{ $node.block1.data.array }}",
			expected: []interface{}{1, 2, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ResolveVariables(tt.input, state)
			if err != nil {
				t.Fatalf("ResolveVariables() error = %v", err)
			}
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ResolveVariables() = %v (%T), want %v (%T)",
					result, result, tt.expected, tt.expected)
			}
		})
	}
}

// TestResolveVariablesMultipleInString verifies multiple variable replacements in one string
func TestResolveVariablesMultipleInString(t *testing.T) {
	state := map[string]interface{}{
		"user": map[string]interface{}{
			"data": map[string]interface{}{
				"firstName": "John",
				"lastName":  "Doe",
			},
		},
	}

	input := "User: {{ $node.user.data.firstName }} {{ $node.user.data.lastName }}"
	expected := "User: John Doe"

	result, err := ResolveVariables(input, state)
	if err != nil {
		t.Fatalf("ResolveVariables() error = %v", err)
	}

	if result != expected {
		t.Errorf("ResolveVariables() = %v, want %v", result, expected)
	}
}

// TestResolveVariablesComplexNesting verifies deeply nested structures
func TestResolveVariablesComplexNesting(t *testing.T) {
	state := map[string]interface{}{
		"api": map[string]interface{}{
			"data": map[string]interface{}{
				"id": 999,
			},
		},
	}

	input := map[string]interface{}{
		"level1": map[string]interface{}{
			"level2": map[string]interface{}{
				"level3": []interface{}{
					"{{ $node.api.data.id }}",
					map[string]interface{}{
						"deep": "{{ $node.api.data.id }}",
					},
				},
			},
		},
	}

	result, err := ResolveVariables(input, state)
	if err != nil {
		t.Fatalf("ResolveVariables() error = %v", err)
	}

	resultMap := result.(map[string]interface{})
	level1 := resultMap["level1"].(map[string]interface{})
	level2 := level1["level2"].(map[string]interface{})
	level3 := level2["level3"].([]interface{})

	if level3[0] != 999 {
		t.Errorf("Expected 999 in array, got %v", level3[0])
	}

	deepMap := level3[1].(map[string]interface{})
	if deepMap["deep"] != 999 {
		t.Errorf("Expected 999 in deep object, got %v", deepMap["deep"])
	}
}
