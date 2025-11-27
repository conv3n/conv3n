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
 * Context provided to trigger's start function.
 */
export interface TriggerContext<TConfig = BlockConfig> {
  /** Trigger configuration from workflow definition */
  config: TConfig;
  /** Emit an event to the Go orchestrator and wait for workflow result */
  emitEvent: <TPayload, TResult>(payload: TPayload) => Promise<TResult>;
  /** Signal that the trigger is ready to receive events */
  ready: () => void;
}

/**
 * Trigger definition for long-running event sources.
 */
export interface TriggerDefinition<TConfig = BlockConfig> {
  /** Unique trigger type identifier (e.g., "trigger/http", "trigger/telegram") */
  id: string;
  /** Trigger startup function (should not return until shutdown) */
  start: (ctx: TriggerContext<TConfig>) => Promise<void>;
  /** Optional cleanup function called on shutdown */
  stop?: () => Promise<void>;
}

// =============================================================================
// IPC PROTOCOL
// =============================================================================

/**
 * Messages sent from Go orchestrator to Bun worker (via stdin).
 */
export type OrchestratorMessage =
  | { type: "execute"; input: BlockInput; requestId?: string }
  | { type: "reply"; requestId: string; data: unknown }
  | { type: "kill" };

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
