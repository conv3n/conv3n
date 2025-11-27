/**
 * Conv3n SDK - Build blocks and triggers for the Conv3n visual backend IDE.
 *
 * @example Action Block
 * ```typescript
 * import { createBlock, runBlock } from "@conv3n/sdk";
 *
 * const block = createBlock({
 *   id: "math/add",
 *   run: async (ctx) => {
 *     const { a, b } = ctx.config;
 *     return ctx.output(a + b);
 *   }
 * });
 *
 * runBlock(block);
 * ```
 *
 * @example Trigger
 * ```typescript
 * import { createTrigger, runTrigger } from "@conv3n/sdk";
 *
 * const trigger = createTrigger({
 *   id: "trigger/http",
 *   start: async (ctx) => {
 *     Bun.serve({
 *       port: ctx.config.port,
 *       async fetch(req) {
 *         const result = await ctx.emitEvent({ method: req.method });
 *         return new Response(JSON.stringify(result));
 *       }
 *     });
 *     ctx.ready();
 *   }
 * });
 *
 * runTrigger(trigger);
 * ```
 *
 * @packageDocumentation
 */

// Block API
export { createBlock, runBlock, output, conditionalOutput } from "./block";

// Trigger API
export { createTrigger, runTrigger, onShutdown } from "./trigger";

// IPC utilities (for advanced use cases)
export {
  sendMessage,
  sendResult,
  sendError,
  sendReady,
  readInput,
  emitEventAndWait,
  generateRequestId,
} from "./ipc";

// Types
export type {
  // Block types
  BlockConfig,
  BlockInput,
  BlockResult,
  BlockContext,
  BlockDefinition,
  // Trigger types
  TriggerContext,
  TriggerDefinition,
  // IPC types
  OrchestratorMessage,
  WorkerMessage,
  // Utility types
  VariableStore,
} from "./types";
