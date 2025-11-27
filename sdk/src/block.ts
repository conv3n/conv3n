/**
 * Block creation utilities for Conv3n SDK.
 * Provides a clean API for defining action blocks.
 */

import type {
  BlockDefinition,
  BlockContext,
  BlockConfig,
  BlockResult,
  BlockInput,
  VariableStore,
} from "./types";
import { readInput, sendResult, sendError } from "./ipc";

// =============================================================================
// BLOCK CREATION
// =============================================================================

/**
 * Create a new action block.
 * Action blocks execute once and return a result with an output port.
 *
 * @example
 * ```typescript
 * import { createBlock } from "@conv3n/sdk";
 *
 * export default createBlock({
 *   id: "math/add",
 *   run: async (ctx) => {
 *     const { a, b } = ctx.config;
 *     return ctx.output(a + b, "default");
 *   }
 * });
 * ```
 */
export function createBlock<TConfig = BlockConfig, TOutput = unknown>(
  definition: BlockDefinition<TConfig, TOutput>
): BlockDefinition<TConfig, TOutput> {
  return definition;
}

// =============================================================================
// BLOCK EXECUTION
// =============================================================================

/**
 * Run a block with input from stdin and output to stdout.
 * This is the main entry point for block scripts.
 */
export async function runBlock<TConfig = BlockConfig, TOutput = unknown>(
  definition: BlockDefinition<TConfig, TOutput>
): Promise<void> {
  try {
    // Read input from stdin
    const input = await readInput<BlockInput<TConfig>>();

    // Create variable store (placeholder for now, will be populated by orchestrator)
    const vars = createVariableStore({});

    // Create block context
    const ctx: BlockContext<TConfig> = {
      config: input.config,
      input: input.context ?? {},
      vars,
      output: <T>(data: T, port: string = "default"): BlockResult<T> => ({
        data,
        port,
      }),
    };

    // Execute block
    const result = await definition.run(ctx);

    // Send result to orchestrator
    sendResult(result.data, result.port);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendError(error.message, error.stack);
    process.exit(1);
  }
}

// =============================================================================
// VARIABLE STORE
// =============================================================================

/**
 * Create a variable store from initial values.
 */
function createVariableStore(
  initial: Record<string, unknown>
): VariableStore {
  const store = new Map<string, unknown>(Object.entries(initial));

  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: unknown) => store.set(name, value),
    has: (name: string) => store.has(name),
    delete: (name: string) => store.delete(name),
    all: () => Object.fromEntries(store),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a successful output result.
 */
export function output<T>(data: T, port: string = "default"): BlockResult<T> {
  return { data, port };
}

/**
 * Create a conditional output (for if/else blocks).
 */
export function conditionalOutput<T>(
  data: T,
  condition: boolean
): BlockResult<T> {
  return { data, port: condition ? "true" : "false" };
}
