package engine

import (
	"fmt"
	"regexp"
	"strings"
)

// Regex to find {{ $node["block_id"].data.field }} or {{ $vars.name }}
// It finds everything inside double curly braces
var variableRegex = regexp.MustCompile(`\{\{\s*([^}]+)\s*\}\}`)

// ResolveVariables traverses the config (input) and replaces templates with real data from context.
// Supports both $node.* (node results) and $vars.* (user variables) syntax.
func ResolveVariables(input interface{}, ctx *ExecutionContext) (interface{}, error) {
	switch v := input.(type) {
	case string:
		// If string contains {{ ... }}, try to replace
		return replaceString(v, ctx)
	case map[string]interface{}:
		// If object, recursively go inside
		newMap := make(map[string]interface{})
		for k, val := range v {
			resolved, err := ResolveVariables(val, ctx)
			if err != nil {
				return nil, err
			}
			newMap[k] = resolved
		}
		return newMap, nil
	case []interface{}:
		// If array, recursively go through elements
		newSlice := make([]interface{}, len(v))
		for i, val := range v {
			resolved, err := ResolveVariables(val, ctx)
			if err != nil {
				return nil, err
			}
			newSlice[i] = resolved
		}
		return newSlice, nil
	default:
		// Numbers, booleans return as is
		return v, nil
	}
}

func replaceString(str string, ctx *ExecutionContext) (interface{}, error) {
	// Find all occurrences of {{ path.to.value }}
	matches := variableRegex.FindAllStringSubmatch(str, -1)
	if len(matches) == 0 {
		return str, nil
	}

	// If the string is ENTIRELY a variable (e.g. "{{ $node.a.data }}"),
	// we want to return the original data type (e.g. number or object), not string.
	if len(matches) == 1 && matches[0][0] == str {
		path := strings.TrimSpace(matches[0][1])
		return getValueByPath(path, ctx)
	}

	// Otherwise do string interpolation
	// "Hello {{ $node.a.name }}" -> "Hello Zaraza"
	result := str
	for _, match := range matches {
		fullMatch := match[0]               // {{ ... }}
		path := strings.TrimSpace(match[1]) // path inside

		val, err := getValueByPath(path, ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve variable %s: %v", fullMatch, err)
		}

		result = strings.Replace(result, fullMatch, fmt.Sprintf("%v", val), 1)
	}

	return result, nil
}

// getValueByPath retrieves value from context by path.
// Supports:
// - $node.ID.data.field - access node results
// - $vars.name - access user-defined variables
// - $error.message - access error info (in catch blocks)
func getValueByPath(path string, ctx *ExecutionContext) (interface{}, error) {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil, fmt.Errorf("empty path")
	}

	// Determine the root scope
	root := parts[0]

	var current interface{}

	switch root {
	case "$node":
		// Access node results: $node.block_id.data.field
		if len(parts) < 2 {
			return nil, fmt.Errorf("$node requires at least node ID: $node.ID")
		}
		current = ctx.Results
		parts = parts[1:] // Skip $node prefix

	case "$vars":
		// Access user variables: $vars.counter
		if len(parts) < 2 {
			return nil, fmt.Errorf("$vars requires variable name: $vars.name")
		}
		varName := parts[1]
		val, exists := ctx.Variables[varName]
		if !exists {
			return nil, fmt.Errorf("variable not found: %s", varName)
		}
		// If accessing nested field: $vars.obj.field
		if len(parts) > 2 {
			current = val
			parts = parts[2:]
		} else {
			return val, nil
		}

	case "$error":
		// Access error info: $error.message (for catch blocks)
		// TODO: Implement error context when adding try/catch
		return nil, fmt.Errorf("$error not yet implemented")

	default:
		// Legacy support: direct node ID without $node prefix
		// e.g., "block_1.data.field" -> same as "$node.block_1.data.field"
		current = ctx.Results
	}

	// Traverse the path
	for _, key := range parts {
		// Clean key from quotes and brackets (for MVP simplicity)
		key = strings.Trim(key, "[]\"'")

		asMap, ok := current.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot traverse path %s: not a map (got %T)", key, current)
		}

		val, exists := asMap[key]
		if !exists {
			return nil, fmt.Errorf("key not found: %s", key)
		}
		current = val
	}

	return current, nil
}
