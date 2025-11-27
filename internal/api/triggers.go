package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/conv3n/conv3n/internal/engine"
	"github.com/conv3n/conv3n/internal/storage"
)

// TriggerHandler handles trigger CRUD operations
type TriggerHandler struct {
	Store          storage.Storage
	TriggerManager *engine.TriggerManager
}

// NewTriggerHandler creates a new trigger handler
func NewTriggerHandler(store storage.Storage, manager *engine.TriggerManager) *TriggerHandler {
	return &TriggerHandler{
		Store:          store,
		TriggerManager: manager,
	}
}

// CreateTriggerRequest represents the request body for creating a trigger
type CreateTriggerRequest struct {
	WorkflowID string                 `json:"workflow_id"`
	Type       string                 `json:"type"` // cron, interval, webhook
	Config     map[string]interface{} `json:"config"`
	Enabled    bool                   `json:"enabled"`
}

// Create handles POST /api/triggers
func (h *TriggerHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.WorkflowID == "" {
		http.Error(w, "workflow_id is required", http.StatusBadRequest)
		return
	}
	if req.Type == "" {
		http.Error(w, "type is required", http.StatusBadRequest)
		return
	}
	if req.Type != "cron" && req.Type != "interval" && req.Type != "webhook" {
		http.Error(w, "type must be cron, interval, or webhook", http.StatusBadRequest)
		return
	}

	// Verify workflow exists
	_, err := h.Store.GetWorkflow(r.Context(), req.WorkflowID)
	if err != nil {
		http.Error(w, "Workflow not found: "+err.Error(), http.StatusNotFound)
		return
	}

	// Encode config as JSON
	configBytes, err := json.Marshal(req.Config)
	if err != nil {
		http.Error(w, "Failed to encode config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create trigger
	trigger := &storage.Trigger{
		ID:         fmt.Sprintf("trigger_%d", time.Now().UnixNano()),
		WorkflowID: req.WorkflowID,
		Type:       req.Type,
		Config:     configBytes,
		Enabled:    req.Enabled,
	}

	if err := h.Store.CreateTrigger(r.Context(), trigger); err != nil {
		http.Error(w, "Failed to create trigger: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// If enabled, register with TriggerManager
	if trigger.Enabled {
		if err := h.registerTrigger(trigger); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: failed to register trigger: %v\n", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(trigger)
}

// Get handles GET /api/triggers/{id}
func (h *TriggerHandler) Get(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("id")
	if triggerID == "" {
		http.Error(w, "Missing trigger ID", http.StatusBadRequest)
		return
	}

	trigger, err := h.Store.GetTrigger(r.Context(), triggerID)
	if err != nil {
		http.Error(w, "Trigger not found: "+err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trigger)
}

// List handles GET /api/triggers?workflow_id={id}
func (h *TriggerHandler) List(w http.ResponseWriter, r *http.Request) {
	workflowID := r.URL.Query().Get("workflow_id")

	var triggers []*storage.Trigger
	var err error

	if workflowID != "" {
		triggers, err = h.Store.ListTriggers(r.Context(), workflowID)
	} else {
		triggers, err = h.Store.ListAllTriggers(r.Context())
	}

	if err != nil {
		http.Error(w, "Failed to list triggers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(triggers)
}

// Update handles PUT /api/triggers/{id}
func (h *TriggerHandler) Update(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("id")
	if triggerID == "" {
		http.Error(w, "Missing trigger ID", http.StatusBadRequest)
		return
	}

	var req CreateTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Get existing trigger
	existing, err := h.Store.GetTrigger(r.Context(), triggerID)
	if err != nil {
		http.Error(w, "Trigger not found: "+err.Error(), http.StatusNotFound)
		return
	}

	// Encode config
	configBytes, err := json.Marshal(req.Config)
	if err != nil {
		http.Error(w, "Failed to encode config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update trigger
	existing.WorkflowID = req.WorkflowID
	existing.Type = req.Type
	existing.Config = configBytes
	wasEnabled := existing.Enabled
	existing.Enabled = req.Enabled

	if err := h.Store.UpdateTrigger(r.Context(), existing); err != nil {
		http.Error(w, "Failed to update trigger: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Handle trigger manager updates
	if wasEnabled && !existing.Enabled {
		// Trigger was disabled
		h.TriggerManager.Unregister(triggerID)
	} else if !wasEnabled && existing.Enabled {
		// Trigger was enabled
		if err := h.registerTrigger(existing); err != nil {
			fmt.Printf("Warning: failed to register trigger: %v\n", err)
		}
	} else if existing.Enabled {
		// Trigger config changed while enabled - re-register
		h.TriggerManager.Unregister(triggerID)
		if err := h.registerTrigger(existing); err != nil {
			fmt.Printf("Warning: failed to register trigger: %v\n", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(existing)
}

// Delete handles DELETE /api/triggers/{id}
func (h *TriggerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("id")
	if triggerID == "" {
		http.Error(w, "Missing trigger ID", http.StatusBadRequest)
		return
	}

	// Unregister from TriggerManager first
	h.TriggerManager.Unregister(triggerID)

	// Delete from database
	if err := h.Store.DeleteTrigger(r.Context(), triggerID); err != nil {
		http.Error(w, "Failed to delete trigger: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListExecutions handles GET /api/triggers/{id}/executions
func (h *TriggerHandler) ListExecutions(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("id")
	if triggerID == "" {
		http.Error(w, "Missing trigger ID", http.StatusBadRequest)
		return
	}

	executions, err := h.Store.ListTriggerExecutions(r.Context(), triggerID, 100)
	if err != nil {
		http.Error(w, "Failed to list executions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(executions)
}

// registerTrigger creates and registers a trigger runner with the TriggerManager
func (h *TriggerHandler) registerTrigger(trigger *storage.Trigger) error {
	// Parse config
	var config map[string]interface{}
	if err := json.Unmarshal(trigger.Config, &config); err != nil {
		return fmt.Errorf("failed to parse trigger config: %w", err)
	}

	var runner engine.TriggerRunner

	switch trigger.Type {
	case "cron":
		schedule, ok := config["schedule"].(string)
		if !ok {
			return fmt.Errorf("cron trigger requires 'schedule' field")
		}
		runner = engine.NewCronTrigger(trigger.ID, trigger.WorkflowID, schedule, h.TriggerManager)

	case "interval":
		intervalSec, ok := config["interval"].(float64)
		if !ok {
			return fmt.Errorf("interval trigger requires 'interval' field (seconds)")
		}
		interval := time.Duration(intervalSec) * time.Second
		runner = engine.NewIntervalTrigger(trigger.ID, trigger.WorkflowID, interval, h.TriggerManager)

	case "webhook":
		runner = engine.NewWebhookTrigger(trigger.ID, trigger.WorkflowID, h.TriggerManager)

	default:
		return fmt.Errorf("unsupported trigger type: %s", trigger.Type)
	}

	return h.TriggerManager.Register(runner)
}

// HandleWebhook handles POST /api/webhooks/{id}
func (h *TriggerHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	triggerID := r.PathValue("id")
	if triggerID == "" {
		http.Error(w, "Missing trigger ID", http.StatusBadRequest)
		return
	}

	// Get trigger to verify it exists and is enabled
	trigger, err := h.Store.GetTrigger(r.Context(), triggerID)
	if err != nil {
		http.Error(w, "Trigger not found", http.StatusNotFound)
		return
	}

	if !trigger.Enabled {
		http.Error(w, "Trigger is disabled", http.StatusForbidden)
		return
	}

	if trigger.Type != "webhook" {
		http.Error(w, "Trigger is not a webhook", http.StatusBadRequest)
		return
	}

	// Read body
	var body interface{}
	if r.Body != nil {
		defer r.Body.Close()
		// Try to parse as JSON, otherwise read as string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			// Not JSON, maybe raw string?
			// For now, let's just leave body as nil if not JSON or handle raw bytes if needed.
			// But for MVP, let's assume JSON or empty.
			// If we want to support raw body, we would need to read all bytes first.
			// Let's keep it simple: if JSON decode fails, body is nil or partial.
		}
	}

	// Construct payload
	payload := map[string]interface{}{
		"headers": r.Header,
		"method":  r.Method,
		"query":   r.URL.Query(),
		"body":    body,
	}

	// Fire trigger
	if err := h.TriggerManager.Fire(r.Context(), triggerID, payload); err != nil {
		http.Error(w, "Failed to fire trigger: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
