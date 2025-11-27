/**
 * IPC (Inter-Process Communication) module for Conv3n SDK.
 * Handles stdin/stdout JSON streaming between Go orchestrator and Bun workers.
 */

import type { OrchestratorMessage, WorkerMessage, BlockResult } from "./types";

// =============================================================================
// OUTPUT (Bun -> Go)
// =============================================================================

/**
 * Send a message to the Go orchestrator via stdout.
 * All messages are JSON-encoded with a newline delimiter.
 */
export function sendMessage(message: WorkerMessage): void {
  console.log(JSON.stringify(message));
}

/**
 * Send block execution result to orchestrator.
 */
export function sendResult<T>(data: T, port: string = "default"): void {
  sendMessage({ type: "result", data, port });
}

/**
 * Send an event from a trigger to orchestrator.
 * Returns a promise that resolves when the orchestrator sends a reply.
 */
export function sendEvent(requestId: string, payload: unknown): void {
  sendMessage({ type: "event", requestId, payload });
}

/**
 * Signal that the trigger is ready to receive events.
 */
export function sendReady(): void {
  sendMessage({ type: "status", status: "ready" });
}

/**
 * Send an error message to orchestrator.
 */
export function sendError(message: string, stack?: string): void {
  sendMessage({ type: "error", message, stack });
}

// =============================================================================
// INPUT (Go -> Bun)
// =============================================================================

/**
 * Read a single JSON message from stdin.
 * Used for simple action blocks that execute once and exit.
 */
export async function readInput<T = unknown>(): Promise<T> {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Try to parse complete JSON
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex !== -1) {
      const jsonStr = buffer.slice(0, newlineIndex);
      try {
        return JSON.parse(jsonStr) as T;
      } catch {
        // Continue reading if JSON is incomplete
      }
    }
  }

  // Try to parse whatever we have
  if (buffer.trim()) {
    return JSON.parse(buffer.trim()) as T;
  }

  throw new Error("No input received from stdin");
}

// =============================================================================
// STREAMING INPUT (for triggers)
// =============================================================================

/**
 * Pending requests waiting for replies from orchestrator.
 * Maps requestId -> resolve function.
 */
const pendingRequests = new Map<string, (data: unknown) => void>();

/**
 * Start listening for messages from orchestrator.
 * Used by triggers to receive replies for emitted events.
 */
export async function startMessageLoop(
  onMessage?: (msg: OrchestratorMessage) => void
): Promise<void> {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line) as OrchestratorMessage;
        handleOrchestratorMessage(msg, onMessage);
      } catch (err) {
        sendError(`Failed to parse message: ${err}`);
      }
    }
  }
}

/**
 * Handle incoming message from orchestrator.
 */
function handleOrchestratorMessage(
  msg: OrchestratorMessage,
  onMessage?: (msg: OrchestratorMessage) => void
): void {
  switch (msg.type) {
    case "reply":
      // Resolve pending request
      const resolver = pendingRequests.get(msg.requestId);
      if (resolver) {
        resolver(msg.data);
        pendingRequests.delete(msg.requestId);
      }
      break;

    case "kill":
      // Graceful shutdown
      process.exit(0);
      break;

    default:
      // Pass to custom handler
      onMessage?.(msg);
  }
}

/**
 * Emit an event and wait for reply from orchestrator.
 * Used by triggers to send events and receive workflow results.
 */
export function emitEventAndWait<TPayload, TResult>(
  payload: TPayload
): Promise<TResult> {
  const requestId = crypto.randomUUID();

  return new Promise<TResult>((resolve) => {
    pendingRequests.set(requestId, resolve as (data: unknown) => void);
    sendEvent(requestId, payload);
  });
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
