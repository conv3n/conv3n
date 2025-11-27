package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/conv3n/conv3n/internal/storage"
	"github.com/robfig/cron/v3"
)

// TriggerType defines the type of trigger
type TriggerType string

const (
	TriggerTypeCron     TriggerType = "cron"
	TriggerTypeInterval TriggerType = "interval"
	TriggerTypeWebhook  TriggerType = "webhook"
)

// Trigger represents a workflow trigger configuration
type Trigger struct {
	ID         string                 `json:"id"`
	WorkflowID string                 `json:"workflow_id"`
	Type       TriggerType            `json:"type"`
	Config     map[string]interface{} `json:"config"`
	Enabled    bool                   `json:"enabled"`
}

// TriggerRunner interface for different trigger implementations
type TriggerRunner interface {
	Start(ctx context.Context) error
	Stop() error
	ID() string
	Type() TriggerType
}

// TriggerManager manages all active triggers
type TriggerManager struct {
	store      storage.Storage
	blocksDir  string
	registry   *ExecutionRegistry
	triggers   map[string]TriggerRunner
	workerPool *WorkerPool
	mu         sync.RWMutex
}

// NewTriggerManager creates a new trigger manager
func NewTriggerManager(store storage.Storage, blocksDir string, registry *ExecutionRegistry, workerPool *WorkerPool) *TriggerManager {
	return &TriggerManager{
		store:      store,
		blocksDir:  blocksDir,
		registry:   registry,
		triggers:   make(map[string]TriggerRunner),
		workerPool: workerPool,
	}
}

// LoadTriggers loads enabled triggers from storage and starts them
func (tm *TriggerManager) LoadTriggers(ctx context.Context) error {
	triggers, err := tm.store.ListAllTriggers(ctx)
	if err != nil {
		return fmt.Errorf("failed to list triggers: %w", err)
	}

	log.Printf("Loading %d triggers from storage...", len(triggers))

	for _, t := range triggers {
		// Parse config
		var config map[string]interface{}
		if err := json.Unmarshal(t.Config, &config); err != nil {
			log.Printf("Error parsing config for trigger %s: %v", t.ID, err)
			continue
		}

		var runner TriggerRunner

		switch t.Type {
		case "cron":
			schedule, ok := config["schedule"].(string)
			if !ok {
				log.Printf("Error: cron trigger %s missing schedule", t.ID)
				continue
			}
			runner = NewCronTrigger(t.ID, t.WorkflowID, schedule, tm)

		case "interval":
			intervalSec, ok := config["interval"].(float64)
			if !ok {
				log.Printf("Error: interval trigger %s missing interval", t.ID)
				continue
			}
			interval := time.Duration(intervalSec) * time.Second
			runner = NewIntervalTrigger(t.ID, t.WorkflowID, interval, tm)

		case "webhook":
			runner = NewWebhookTrigger(t.ID, t.WorkflowID, tm)

		default:
			log.Printf("Warning: unsupported trigger type %s for trigger %s", t.Type, t.ID)
			continue
		}

		if err := tm.Register(runner); err != nil {
			log.Printf("Error registering trigger %s: %v", t.ID, err)
		}
	}

	return nil
}

// Register adds and starts a trigger
func (tm *TriggerManager) Register(trigger TriggerRunner) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if _, exists := tm.triggers[trigger.ID()]; exists {
		return fmt.Errorf("trigger already registered: %s", trigger.ID())
	}

	// Start the trigger
	if err := trigger.Start(context.Background()); err != nil {
		return fmt.Errorf("failed to start trigger: %w", err)
	}

	tm.triggers[trigger.ID()] = trigger
	log.Printf("Registered trigger: %s (type: %s)", trigger.ID(), trigger.Type())
	return nil
}

// Unregister stops and removes a trigger
func (tm *TriggerManager) Unregister(triggerID string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	trigger, exists := tm.triggers[triggerID]
	if !exists {
		return fmt.Errorf("trigger not found: %s", triggerID)
	}

	// Stop the trigger
	if err := trigger.Stop(); err != nil {
		log.Printf("Warning: failed to stop trigger %s: %v", triggerID, err)
	}

	delete(tm.triggers, triggerID)
	log.Printf("Unregistered trigger: %s", triggerID)
	return nil
}

// GetTrigger returns a trigger by ID
func (tm *TriggerManager) GetTrigger(triggerID string) (TriggerRunner, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	trigger, exists := tm.triggers[triggerID]
	return trigger, exists
}

// ListTriggers returns all registered triggers
func (tm *TriggerManager) ListTriggers() []TriggerRunner {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	triggers := make([]TriggerRunner, 0, len(tm.triggers))
	for _, trigger := range tm.triggers {
		triggers = append(triggers, trigger)
	}
	return triggers
}

// StopAll stops all triggers (for graceful shutdown)
func (tm *TriggerManager) StopAll() {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for id, trigger := range tm.triggers {
		if err := trigger.Stop(); err != nil {
			log.Printf("Warning: failed to stop trigger %s: %v", id, err)
		}
	}
	tm.triggers = make(map[string]TriggerRunner)
	log.Println("Stopped all triggers")
}

// ExecuteWorkflow executes a workflow triggered by a trigger
func (tm *TriggerManager) ExecuteWorkflow(ctx context.Context, workflowID, triggerID string) error {
	return tm.Fire(ctx, triggerID, nil)
}

// Fire executes a workflow triggered by a trigger with optional payload
func (tm *TriggerManager) Fire(ctx context.Context, triggerID string, payload map[string]interface{}) error {
	// Use WorkerPool to limit concurrency
	return tm.workerPool.Execute(ctx, func() error {
		// Record trigger execution start
		triggerExec := &storage.TriggerExecution{
			ID:        fmt.Sprintf("texec_%d", time.Now().UnixNano()),
			TriggerID: triggerID,
			FiredAt:   time.Now(),
			Status:    "running",
			Payload:   nil, // Will be updated if payload exists
		}

		if payload != nil {
			payloadBytes, _ := json.Marshal(payload)
			triggerExec.Payload = payloadBytes
		}

		// Get workflow definition
		// First get the trigger to find the workflow ID
		triggerRunner, exists := tm.GetTrigger(triggerID)
		if !exists {
			return fmt.Errorf("trigger not found: %s", triggerID)
		}
		// Use triggerRunner to avoid unused variable error (though we don't strictly need it if we fetch from DB)
		_ = triggerRunner

		// We need to access the workflow ID from the runner.
		// Since TriggerRunner interface doesn't expose WorkflowID directly (it should),
		// we might need to fetch the trigger from DB or cast the runner.
		// For now, let's fetch from DB to be safe and get fresh config.
		trigger, err := tm.store.GetTrigger(ctx, triggerID)
		if err != nil {
			triggerExec.Status = "failed"
			msg := err.Error()
			triggerExec.Error = &msg
			tm.store.CreateTriggerExecution(ctx, triggerExec)
			return fmt.Errorf("failed to get trigger: %w", err)
		}

		workflow, err := tm.store.GetWorkflow(ctx, trigger.WorkflowID)
		if err != nil {
			triggerExec.Status = "failed"
			msg := err.Error()
			triggerExec.Error = &msg
			tm.store.CreateTriggerExecution(ctx, triggerExec)
			return fmt.Errorf("failed to get workflow: %w", err)
		}

		// Parse workflow
		var wf Workflow
		if err := json.Unmarshal(workflow.Definition, &wf); err != nil {
			triggerExec.Status = "failed"
			msg := err.Error()
			triggerExec.Error = &msg
			tm.store.CreateTriggerExecution(ctx, triggerExec)
			return fmt.Errorf("failed to parse workflow: %w", err)
		}

		// Create execution context
		execCtx := NewExecutionContext(wf.ID)
		// Inject trigger payload into context if available
		if payload != nil {
			execCtx.TriggerData = payload
		}

		runner := NewWorkflowRunner(execCtx, tm.blocksDir, tm.store, tm.registry)

		// Execute workflow with timeout
		execContext, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()

		log.Printf("Executing workflow %s triggered by %s", trigger.WorkflowID, triggerID)

		if err := runner.Run(execContext, wf); err != nil {
			triggerExec.Status = "failed"
			msg := err.Error()
			triggerExec.Error = &msg
			tm.store.CreateTriggerExecution(ctx, triggerExec)
			return fmt.Errorf("workflow execution failed: %w", err)
		}

		triggerExec.Status = "success"
		tm.store.CreateTriggerExecution(ctx, triggerExec)

		log.Printf("Workflow %s completed successfully", trigger.WorkflowID)
		return nil
	})
}

// CronTrigger implements cron-based scheduling
type CronTrigger struct {
	id         string
	workflowID string
	schedule   string
	cron       *cron.Cron
	manager    *TriggerManager
}

// NewCronTrigger creates a new cron trigger
func NewCronTrigger(id, workflowID, schedule string, manager *TriggerManager) *CronTrigger {
	return &CronTrigger{
		id:         id,
		workflowID: workflowID,
		schedule:   schedule,
		manager:    manager,
	}
}

func (ct *CronTrigger) ID() string {
	return ct.id
}

func (ct *CronTrigger) Type() TriggerType {
	return TriggerTypeCron
}

func (ct *CronTrigger) Start(ctx context.Context) error {
	ct.cron = cron.New()

	// Add cron job
	_, err := ct.cron.AddFunc(ct.schedule, func() {
		log.Printf("Cron trigger fired: %s (schedule: %s)", ct.id, ct.schedule)

		// Execute workflow asynchronously
		go func() {
			if err := ct.manager.ExecuteWorkflow(context.Background(), ct.workflowID, ct.id); err != nil {
				log.Printf("Cron trigger execution failed: %v", err)
			}
		}()
	})

	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	ct.cron.Start()
	log.Printf("Cron trigger started: %s (schedule: %s)", ct.id, ct.schedule)
	return nil
}

func (ct *CronTrigger) Stop() error {
	if ct.cron != nil {
		ctx := ct.cron.Stop()
		<-ctx.Done()
		log.Printf("Cron trigger stopped: %s", ct.id)
	}
	return nil
}

// IntervalTrigger implements interval-based scheduling
type IntervalTrigger struct {
	id         string
	workflowID string
	interval   time.Duration
	ticker     *time.Ticker
	stop       chan bool
	manager    *TriggerManager
}

// NewIntervalTrigger creates a new interval trigger
func NewIntervalTrigger(id, workflowID string, interval time.Duration, manager *TriggerManager) *IntervalTrigger {
	return &IntervalTrigger{
		id:         id,
		workflowID: workflowID,
		interval:   interval,
		stop:       make(chan bool),
		manager:    manager,
	}
}

func (it *IntervalTrigger) ID() string {
	return it.id
}

func (it *IntervalTrigger) Type() TriggerType {
	return TriggerTypeInterval
}

func (it *IntervalTrigger) Start(ctx context.Context) error {
	it.ticker = time.NewTicker(it.interval)

	go func() {
		for {
			select {
			case <-it.ticker.C:
				log.Printf("Interval trigger fired: %s (interval: %s)", it.id, it.interval)

				// Execute workflow asynchronously
				go func() {
					if err := it.manager.ExecuteWorkflow(context.Background(), it.workflowID, it.id); err != nil {
						log.Printf("Interval trigger execution failed: %v", err)
					}
				}()
			case <-it.stop:
				return
			}
		}
	}()

	log.Printf("Interval trigger started: %s (interval: %s)", it.id, it.interval)
	return nil
}

func (it *IntervalTrigger) Stop() error {
	if it.ticker != nil {
		it.ticker.Stop()
		close(it.stop)
		log.Printf("Interval trigger stopped: %s", it.id)
	}
	return nil
}

// WebhookTrigger implements webhook-based triggering
type WebhookTrigger struct {
	id         string
	workflowID string
	manager    *TriggerManager
}

// NewWebhookTrigger creates a new webhook trigger
func NewWebhookTrigger(id, workflowID string, manager *TriggerManager) *WebhookTrigger {
	return &WebhookTrigger{
		id:         id,
		workflowID: workflowID,
		manager:    manager,
	}
}

func (wt *WebhookTrigger) ID() string {
	return wt.id
}

func (wt *WebhookTrigger) Type() TriggerType {
	return TriggerTypeWebhook
}

func (wt *WebhookTrigger) Start(ctx context.Context) error {
	// Webhook trigger is passive, just log startup
	log.Printf("Webhook trigger started: %s (waiting for POST /api/webhooks/%s)", wt.id, wt.id)
	return nil
}

func (wt *WebhookTrigger) Stop() error {
	// Nothing to stop for passive trigger
	log.Printf("Webhook trigger stopped: %s", wt.id)
	return nil
}
