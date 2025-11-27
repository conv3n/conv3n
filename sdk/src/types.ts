/**
 * Core types for Conv3n SDK
 */

// =============================================================================
// BLOCK TYPES
// =============================================================================

/**
 * Configuration passed to a block from the workflow definition.
 */
export type BlockConfig = Record<string, unknown>;

/**
 * Input data passed to a block during execution.
 */
export interface BlockInput<TConfig = BlockConfig> {
  config: TConfig;
  context?: Record<string, unknown>;
}

/**
 * Result returned by a block after execution.
 * Includes data and the output port for routing.
 */
export interface BlockResult<TData = unknown> {
  data: TData;
  port: string;
}

/**
 * Context provided to block's run function.
 */
export interface BlockContext<TConfig = BlockConfig> {
  /** Block configuration from workflow definition */
  config: TConfig;
  /** Input data from previous nodes */
  input: Record<string, unknown>;
  /** Access to user-defined variables */
  vars: VariableStore;
  /** Helper to create output result */
  output: <T>(data: T, port?: string) => BlockResult<T>;
}

/**
 * Block definition for action blocks (execute and exit).
 */
export interface BlockDefinition<TConfig = BlockConfig, TOutput = unknown> {
  /** Unique block type identifier (e.g., "math/add", "std/http_request") */
  id: string;
  /** Block execution function */
  run: (ctx: BlockContext<TConfig>) => Promise<BlockResult<TOutput>>;
}

// =============================================================================
// TRIGGER TYPES
// =============================================================================

/**
 * The context provided to a trigger's lifecycle hooks.
 */
export interface TriggerContext<TConfig = Record<string, unknown>> {
  /**
   * The configuration for this specific trigger instance, as defined in the workflow.
   */
  config: TConfig;
  /**
   * Fires the trigger, causing the associated workflow to execute.
   * The provided payload will be available to the workflow via `ctx.trigger`.
   * @param payload - The data payload to send with the event.
   * @returns A promise that resolves with the result of the workflow execution.
   */
  fire: <TPayload, TResult>(payload: TPayload) => Promise<TResult>;
}

/**
 * Definition of a trigger's behavior and lifecycle hooks.
 */
export interface TriggerDefinition<TConfig = Record<string, unknown>> {
  /**
   * A unique identifier for the trigger type.
   * @example "cron", "webhook"
   */
  id: string;

  /**
   * Called when the trigger is first started by the Conv3n engine.
   * This is the place to initialize resources, start timers, or connect to services.
   * @param ctx - The trigger context, including config and the `fire` function.
   */
  onStart: (ctx: TriggerContext<TConfig>) => Promise<void>;

  /**
   * Called when the Conv3n engine is shutting down or the trigger is being disabled.
   * This is the place to clean up resources, close connections, etc.
   * @param ctx - The trigger context.
   */
  onStop: (ctx: TriggerContext<TConfig>) => Promise<void>;

  /**
   * Optional: A handler for custom messages sent from the Go host.
   * For example, a webhook trigger would use this to receive incoming HTTP requests.
   * @param message - The message received from the Go host.
   * @param ctx - The trigger context.
   */
  onMessage?: (
    message: OrchestratorMessage,
    ctx: TriggerContext<TConfig>
  ) => Promise<void>;
}

// =============================================================================
// IPC PROTOCOL
// =============================================================================

/**
 * Messages sent from Go orchestrator to Bun worker (via stdin).
 */
export type OrchestratorMessage =
  // Block-related
  | { type: "execute"; input: BlockInput; requestId?: string }
  // Trigger-related
  | { type: "start"; config: Record<string, unknown> }
  | { type: "reply"; requestId: string; data: unknown }
  | { type: "kill" }
  // General
  | { type: "invoke"; payload: unknown }; // For triggers like webhooks

/**
 * Messages sent from Bun worker to Go orchestrator (via stdout).
 */
export type WorkerMessage =
  | { type: "result"; data: unknown; port: string }
  | { type: "event"; requestId: string; payload: unknown }
  | { type: "status"; status: "ready" | "error"; message?: string }
  | { type: "error"; message: string; stack?: string };

// =============================================================================
// VARIABLE STORE
// =============================================================================

/**
 * Interface for accessing user-defined variables.
 */
export interface VariableStore {
  get: (name: string) => unknown;
  set: (name: string, value: unknown) => void;
  has: (name: string) => boolean;
  delete: (name: string) => boolean;
  all: () => Record<string, unknown>;
}
