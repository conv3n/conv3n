package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/conv3n/conv3n/internal/engine"
	"github.com/conv3n/conv3n/internal/storage"
)

// Server holds the server configuration
type Server struct {
	BlocksDir string
	Store     storage.Storage
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	// Determine blocks directory
	blocksDir := os.Getenv("CONV3N_BLOCKS_DIR")
	if blocksDir == "" {
		cwd, _ := os.Getwd()
		blocksDir = filepath.Join(cwd, "pkg", "blocks")
	}

	// Initialize Storage
	store, err := storage.NewSQLite("conv3n.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	switch command {
	case "server":
		runServer(blocksDir, store)
	case "run":
		if len(os.Args) < 3 {
			fmt.Println("Usage: conv3n run <workflow_file.json>")
			os.Exit(1)
		}
		runCLI(os.Args[2], blocksDir, store)
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  conv3n server               Start the API server")
	fmt.Println("  conv3n run <workflow.json>  Run a workflow file once (CLI mode)")
}

// --- Server Mode ---

func runServer(blocksDir string, store storage.Storage) {
	fmt.Println("Starting Conv3n API Server...")
	server := &Server{
		BlocksDir: blocksDir,
		Store:     store,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/run", server.handleRun)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)
		w.Write([]byte("OK"))
	})

	fmt.Printf("Listening on http://localhost:8080\n")
	fmt.Printf("Blocks loaded from: %s\n", blocksDir)

	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}

type RunRequest struct {
	Workflow engine.Workflow `json:"workflow"`
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		return
	}

	var req RunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad JSON: "+err.Error(), 400)
		return
	}

	ctx := engine.NewExecutionContext(req.Workflow.ID)
	runner := engine.NewWorkflowRunner(ctx, s.BlocksDir, s.Store)

	fmt.Printf("New Job: %s\n", req.Workflow.Name)

	if err := runner.Run(r.Context(), req.Workflow); err != nil {
		http.Error(w, "Execution Failed: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"results": ctx.Results,
	})
}

func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// --- CLI Mode ---

func runCLI(filePath string, blocksDir string, store storage.Storage) {
	fmt.Printf("Reading workflow from: %s\n", filePath)

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Failed to read file: %v", err)
	}

	var workflow engine.Workflow
	if err := json.Unmarshal(data, &workflow); err != nil {
		log.Fatalf("Failed to parse workflow JSON: %v", err)
	}

	fmt.Println("Starting conv3n (Bunock) Engine...")
	fmt.Printf("Using Blocks Directory: %s\n", blocksDir)

	ctx := engine.NewExecutionContext(workflow.ID)
	runner := engine.NewWorkflowRunner(ctx, blocksDir, store)

	fmt.Printf("Running Workflow: %s\n", workflow.Name)

	execCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := runner.Run(execCtx, workflow); err != nil {
		log.Fatalf("Workflow execution failed: %v", err)
	}

	fmt.Println("\n--- Execution Results ---")
	for blockID, result := range ctx.Results {
		resMap, ok := result.(map[string]interface{})
		if !ok {
			fmt.Printf("Block [%s]: %+v\n\n", blockID, result)
			continue
		}

		// Handle standard blocks (http_request, etc.) - they have "status" and "data"
		if status, hasStatus := resMap["status"]; hasStatus {
			data := resMap["data"]
			fmt.Printf("Block [%s]: Status %v\n", blockID, status)
			fmt.Printf("Data: %+v\n\n", data)
		} else if success, hasSuccess := resMap["success"]; hasSuccess {
			// Handle custom/code blocks - they have "success", "data", and "executionTime"
			data := resMap["data"]
			execTime := resMap["executionTime"]
			fmt.Printf("Block [%s]: Success %v (%.2fms)\n", blockID, success, execTime)
			fmt.Printf("Data: %+v\n\n", data)
		} else {
			// Fallback for unknown structure
			fmt.Printf("Block [%s]: %+v\n\n", blockID, resMap)
		}
	}

}
