package engine

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/conv3n/conv3n/internal/storage"
)

func newTestStorage(t *testing.T) storage.Storage {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := storage.NewSQLite(dbPath)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	t.Cleanup(func() {
		store.Close()
	})

	return store
}

func TestTriggerManager(t *testing.T) {
	store := newTestStorage(t)
	registry := NewExecutionRegistry()
	workerPool := NewWorkerPool(10)
	// Use a temp dir for blocks, though we won't actually run blocks in these tests
	blocksDir := t.TempDir()

	tm := NewTriggerManager(store, blocksDir, registry, workerPool)
	t.Cleanup(func() {
		tm.StopAll()
		workerPool.Wait()
	})

	t.Run("RegisterAndUnregister", func(t *testing.T) {
		trigger := NewWebhookTrigger("trigger-1", "wf-1", tm)

		// Register
		err := tm.Register(trigger)
		if err != nil {
			t.Fatalf("failed to register trigger: %v", err)
		}

		// Check if registered
		if len(tm.ListTriggers()) != 1 {
			t.Errorf("expected 1 trigger, got %d", len(tm.ListTriggers()))
		}

		got, exists := tm.GetTrigger("trigger-1")
		if !exists {
			t.Error("trigger not found")
		}
		if got.ID() != "trigger-1" {
			t.Errorf("expected ID trigger-1, got %s", got.ID())
		}

		// Unregister
		err = tm.Unregister("trigger-1")
		if err != nil {
			t.Fatalf("failed to unregister trigger: %v", err)
		}

		if len(tm.ListTriggers()) != 0 {
			t.Errorf("expected 0 triggers, got %d", len(tm.ListTriggers()))
		}
	})

	t.Run("LoadTriggers", func(t *testing.T) {
		ctx := context.Background()

		// Create a trigger in DB
		config := map[string]interface{}{
			"schedule": "* * * * *",
		}
		configBytes, _ := json.Marshal(config)

		dbTrigger := &storage.Trigger{
			ID:         "cron-1",
			WorkflowID: "wf-1",
			Type:       "cron",
			Config:     configBytes,
			Enabled:    true,
		}

		if err := store.CreateTrigger(ctx, dbTrigger); err != nil {
			t.Fatalf("failed to create trigger in db: %v", err)
		}

		// Load triggers
		if err := tm.LoadTriggers(ctx); err != nil {
			t.Fatalf("failed to load triggers: %v", err)
		}

		// Verify loaded
		if _, exists := tm.GetTrigger("cron-1"); !exists {
			t.Error("cron trigger was not loaded")
		}

		// Cleanup
		tm.Unregister("cron-1")
	})

	t.Run("Fire_Webhook", func(t *testing.T) {
		ctx := context.Background()

		// Setup: Create Workflow and Trigger in DB
		wfDef := map[string]interface{}{
			"id":    "wf-webhook",
			"nodes": []interface{}{},
			"edges": []interface{}{},
		}
		wfBytes, _ := json.Marshal(wfDef)

		err := store.CreateWorkflow(ctx, &storage.Workflow{
			ID:         "wf-webhook",
			Name:       "Webhook Workflow",
			Definition: wfBytes,
		})
		if err != nil {
			t.Fatalf("failed to create workflow: %v", err)
		}

		trigger := &storage.Trigger{
			ID:         "webhook-1",
			WorkflowID: "wf-webhook",
			Type:       "webhook",
			Config:     []byte("{}"),
			Enabled:    true,
		}
		store.CreateTrigger(ctx, trigger)

		// Register trigger in manager
		runner := NewWebhookTrigger("webhook-1", "wf-webhook", tm)
		tm.Register(runner)
		defer tm.Unregister("webhook-1")

		// Fire
		payload := map[string]interface{}{"foo": "bar"}
		err = tm.Fire(ctx, "webhook-1", payload)
		if err != nil {
			t.Fatalf("failed to fire trigger: %v", err)
		}

		// Wait a bit for async execution
		time.Sleep(100 * time.Millisecond)

		// Check if execution was created
		execs, err := store.ListTriggerExecutions(ctx, "webhook-1", 10)
		if err != nil {
			t.Fatalf("failed to list executions: %v", err)
		}

		if len(execs) == 0 {
			t.Error("expected trigger execution record")
		}
	})
}
