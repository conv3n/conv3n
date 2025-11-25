package engine

import (
	"fmt"
	"regexp"
	"strings"
)

// Regex to find {{ $node["block_id"].data.field }}
// It finds everything inside double curly braces
var variableRegex = regexp.MustCompile(`\{\{\s*([^}]+)\s*\}\}`)

// ResolveVariables traverses the config (input) and replaces templates with real data from state.
func ResolveVariables(input interface{}, state map[string]interface{}) (interface{}, error) {
	switch v := input.(type) {
	case string:
		// If string contains {{ ... }}, try to replace
		return replaceString(v, state)
	case map[string]interface{}:
		// If object, recursively go inside
		newMap := make(map[string]interface{})
		for k, val := range v {
			resolved, err := ResolveVariables(val, state)
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
			resolved, err := ResolveVariables(val, state)
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

func replaceString(str string, state map[string]interface{}) (interface{}, error) {
	// Find all occurrences of {{ path.to.value }}
	matches := variableRegex.FindAllStringSubmatch(str, -1)
	if len(matches) == 0 {
		return str, nil
	}

	// If the string is ENTIRELY a variable (e.g. "{{ $node.a.data }}"),
	// we want to return the original data type (e.g. number or object), not string.
	if len(matches) == 1 && matches[0][0] == str {
		path := strings.TrimSpace(matches[0][1])
		return getValueByPath(path, state)
	}

	// Otherwise do string interpolation
	// "Hello {{ $node.a.name }}" -> "Hello Zaraza"
	result := str
	for _, match := range matches {
		fullMatch := match[0]               // {{ ... }}
		path := strings.TrimSpace(match[1]) // path inside

		val, err := getValueByPath(path, state)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve variable %s: %v", fullMatch, err)
		}

		result = strings.Replace(result, fullMatch, fmt.Sprintf("%v", val), 1)
	}

	return result, nil
}

// getValueByPath retrieves value from state by path.
// Example path: $node.get_todo.data.userId
func getValueByPath(path string, state map[string]interface{}) (interface{}, error) {
	// 1. Parse syntax $node.ID...
	// For MVP we use simplified parsing: get_todo.data.userId
	// Since parsing ["..."] is hard with regex/split, let's use dots for now:
	// $node.get_todo.data.userId

	parts := strings.Split(path, ".")

	// Start search from root state
	// State contains block results by ID
	var current interface{} = state

	// Hack for MVP: if path starts with $node, skip it,
	// because state already contains the map of blocks
	if len(parts) > 0 && parts[0] == "$node" {
		parts = parts[1:]
	}

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
