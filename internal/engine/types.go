package engine

// BlockType defines the type of the block (e.g., "std/http_request", "custom/code").
type BlockType string

const (
	BlockTypeHTTPRequest BlockType = "std/http_request"
	BlockTypeCustomCode  BlockType = "custom/code"
	BlockTypeCondition   BlockType = "std/condition"
	BlockTypeLoop        BlockType = "std/loop"
	BlockTypeTransform   BlockType = "std/transform"
)

// BlockConfig holds the configuration for a block.
// This is what the user configures in the UI.
type BlockConfig = map[string]interface{}

// Block represents a single step in the workflow.
type Block struct {
	ID     string      `json:"id"`
	Type   BlockType   `json:"type"`
	Config BlockConfig `json:"config"`
	// Code is used only for BlockTypeCustomCode
	Code string `json:"code,omitempty"`
}

// Connection represents a link between two blocks.
type Connection struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Workflow represents the entire graph of blocks.
type Workflow struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Blocks      []Block      `json:"blocks"`
	Connections []Connection `json:"connections"`
}

// ExecutionContext holds the state of a running workflow.
type ExecutionContext struct {
	WorkflowID string
	// Results stores the output of each block by Block ID.
	Results map[string]interface{}
}

// NewExecutionContext creates a new context for a workflow execution.
func NewExecutionContext(workflowID string) *ExecutionContext {
	return &ExecutionContext{
		WorkflowID: workflowID,
		Results:    make(map[string]interface{}),
	}
}
