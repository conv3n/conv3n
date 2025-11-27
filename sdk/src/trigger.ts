/**
 * Trigger creation utilities for Conv3n SDK.
 * Provides a clean API for defining long-running triggers.
 */
import {
  startMessageLoop,
  sendReady,
  sendError,
  emitEventAndWait,
} from "./ipc";
import type { OrchestratorMessage } from "./types";

// =============================================================================
// TYPE DEFINITIONS
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
// TRIGGER CREATION
// =============================================================================

/**
 * Create a new trigger definition.
 *
 * @example
 * ```typescript
 * import { createTrigger } from "@conv3n/sdk";
 *
 * export default createTrigger({
 *   id: "my-trigger",
 *   async onStart(ctx) {
 *     console.log("My trigger started with config:", ctx.config);
 *     // Fire the trigger every 10 seconds
 *     setInterval(() => {
 *       ctx.fire({ timestamp: Date.now() });
 *     }, 10000);
 *   },
 *   async onStop(ctx) {
 *     console.log("My trigger stopped.");
 *     // Clean up resources like intervals
 *     // (Note: In this simple example, setInterval is not cleaned up,
 *     // but in a real trigger, you should manage the interval ID.)
 *   }
 * });
 * ```
 */
export function createTrigger<TConfig = Record<string, unknown>>(
  definition: TriggerDefinition<TConfig>
): TriggerDefinition<TConfig> {
  return definition;
}

// =============================================================================
// TRIGGER EXECUTION
// =============================================================================

/**
 * Run a trigger, connecting it to the Go orchestrator.
 * This is the main entry point for trigger scripts.
 */
export async function runTrigger<TConfig = Record<string, unknown>>(
  definition: TriggerDefinition<TConfig>
): Promise<void> {
  let context: TriggerContext<TConfig> | null = null;

  try {
    // The first message from the orchestrator will be the config
    await startMessageLoop(async (msg) => {
      if (msg.type === "start") {
        // Initialize context and run onStart
        context = {
          config: msg.config as TConfig,
          fire: (payload) => emitEventAndWait(payload),
        };
        await definition.onStart(context);

        // Signal to the orchestrator that the trigger is initialized and ready
        sendReady();
      } else if (msg.type === "kill") {
        // Run onStop and exit
        if (context) {
          await definition.onStop(context);
        }
        process.exit(0);
      } else {
        // Handle other messages, e.g., for webhooks
        if (definition.onMessage && context) {
          await definition.onMessage(msg, context);
        }
      }
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendError(error.message, error.stack);
    process.exit(1);
  }
}