/**
 * Trigger creation utilities for Conv3n SDK.
 * Provides a clean API for defining long-running event sources.
 */

import type {
  TriggerDefinition,
  TriggerContext,
  BlockConfig,
  BlockInput,
} from "./types";
import {
  readInput,
  sendReady,
  sendError,
  startMessageLoop,
  emitEventAndWait,
} from "./ipc";

// =============================================================================
// TRIGGER CREATION
// =============================================================================

/**
 * Create a new trigger block.
 * Triggers are long-running processes that emit events to the orchestrator.
 *
 * @example
 * ```typescript
 * import { createTrigger } from "@conv3n/sdk";
 *
 * export default createTrigger({
 *   id: "trigger/http",
 *   start: async (ctx) => {
 *     Bun.serve({
 *       port: ctx.config.port,
 *       async fetch(req) {
 *         const result = await ctx.emitEvent({
 *           method: req.method,
 *           url: req.url,
 *           body: await req.json()
 *         });
 *         return new Response(JSON.stringify(result));
 *       }
 *     });
 *     ctx.ready();
 *   }
 * });
 * ```
 */
export function createTrigger<TConfig = BlockConfig>(
  definition: TriggerDefinition<TConfig>
): TriggerDefinition<TConfig> {
  return definition;
}

// =============================================================================
// TRIGGER EXECUTION
// =============================================================================

/**
 * Run a trigger with configuration from stdin.
 * This is the main entry point for trigger scripts.
 */
export async function runTrigger<TConfig = BlockConfig>(
  definition: TriggerDefinition<TConfig>
): Promise<void> {
  try {
    // Read initial configuration from stdin
    const input = await readInput<BlockInput<TConfig>>();

    // Create trigger context
    const ctx: TriggerContext<TConfig> = {
      config: input.config,
      emitEvent: emitEventAndWait,
      ready: sendReady,
    };

    // Start message loop in background to handle replies
    startMessageLoop().catch((err) => {
      sendError(`Message loop error: ${err}`);
    });

    // Start the trigger (this should block until shutdown)
    await definition.start(ctx);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendError(error.message, error.stack);
    process.exit(1);
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

let shutdownHandler: (() => Promise<void>) | null = null;

/**
 * Register a cleanup handler for graceful shutdown.
 */
export function onShutdown(handler: () => Promise<void>): void {
  shutdownHandler = handler;
}

// Handle process signals for graceful shutdown
process.on("SIGTERM", async () => {
  if (shutdownHandler) {
    await shutdownHandler();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  if (shutdownHandler) {
    await shutdownHandler();
  }
  process.exit(0);
});
