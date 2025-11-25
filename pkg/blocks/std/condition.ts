// pkg/blocks/std/condition.ts
// Standard Block: Conditional Branching
// Evaluates JavaScript expressions to enable if/else logic in workflows

import { stdin, stdout } from "bun";

// Type definitions for input/output
export interface ConditionConfig {
    expression: string;      // JavaScript expression to evaluate (e.g., "input.value > 100")
    trueBlockId?: string;    // Optional: ID of block to execute if true (for future DAG routing)
    falseBlockId?: string;   // Optional: ID of block to execute if false (for future DAG routing)
}

export interface ConditionInput {
    config: ConditionConfig;
    input?: any;             // Data from previous blocks for expression evaluation
}

export interface ConditionOutput {
    result: boolean;         // Evaluation result
    expression: string;      // Original expression for debugging
    nextBlockId?: string;    // For future routing support
}

// Validate configuration
export function validateConfig(config: any): void {
    if (!config || typeof config.expression !== 'string') {
        throw new Error("Missing required config: expression (must be a string)");
    }

    if (config.expression.trim().length === 0) {
        throw new Error("Expression cannot be empty");
    }
}

// Safely evaluate JavaScript expression
// Uses Function constructor to create isolated evaluation context
export function evaluateExpression(expression: string, context: any): boolean {
    try {
        // Create a safe evaluation function
        // The expression has access to 'input' variable containing the context
        const evalFunction = new Function('input', `
            'use strict';
            return Boolean(${expression});
        `);

        const result = evalFunction(context);
        return Boolean(result);
    } catch (error: any) {
        throw new Error(`Expression evaluation failed: ${error.message}`);
    }
}

// Validate expression syntax without executing
export function validateExpression(expression: string): void {
    try {
        // Attempt to create function to check syntax
        new Function('input', `'use strict'; return Boolean(${expression});`);
    } catch (error: any) {
        throw new Error(`Invalid expression syntax: ${error.message}`);
    }
}

// Main execution function
export async function main() {
    try {
        // 1. Read input
        const input: ConditionInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Validate expression syntax
        validateExpression(config.expression);

        // 4. Prepare evaluation context
        // Use input.input if available (from previous blocks), otherwise empty object
        const context = input.input || {};

        // 5. Evaluate expression
        const result = evaluateExpression(config.expression, context);

        // 6. Prepare output
        const output: ConditionOutput = {
            result,
            expression: config.expression,
        };

        // Add routing information if provided (for future DAG support)
        if (result && config.trueBlockId) {
            output.nextBlockId = config.trueBlockId;
        } else if (!result && config.falseBlockId) {
            output.nextBlockId = config.falseBlockId;
        }

        // 7. Write output
        await Bun.write(Bun.stdout, JSON.stringify(output));

    } catch (error: any) {
        // Write error to stderr
        console.error(`Condition Block Failed: ${error.message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
