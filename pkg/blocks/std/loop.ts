// pkg/blocks/std/loop.ts
// Standard Block: Loop/Iteration
// Iterates over arrays and applies transformations.

// Type definitions for input/output
export interface LoopConfig {
    items: unknown[];        // Array to iterate over (from {{ $node.X.data }})
    mapExpression?: string;  // Optional: JavaScript expression for mapping (e.g., "item => item * 2")
    filterExpression?: string; // Optional: JavaScript expression for filtering (e.g., "item => item > 10")
}

export interface LoopInput {
    config: LoopConfig;
    input?: unknown;         // Data from previous blocks
}

export interface LoopOutput {
    results: unknown[];      // Processed items
    count: number;           // Number of items processed
    originalCount: number;   // Original array length
}

export interface BlockResult {
    data: LoopOutput;
    port: string;
}



// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (!Array.isArray(config.items)) {
        throw new Error("Config 'items' must be an array");
    }


}

// Validate expression syntax
export function validateExpression(expression: string, paramName: string = 'item'): void {
    try {
        // Create arrow function to check syntax
        new Function(paramName, `'use strict'; return (${expression});`);
    } catch (error: any) {
        throw new Error(`Invalid expression syntax: ${error.message}`);
    }
}

// Apply map expression to items
export function applyMap(items: any[], expression: string): any[] {
    try {
        // Check if expression is an arrow function or simple expression
        const isArrowFunction = expression.includes('=>');

        if (isArrowFunction) {
            // For arrow functions, evaluate the function and call it
            const mapFn = new Function('item', 'index', 'array', `
                'use strict';
                const fn = ${expression};
                return fn(item, index, array);
            `);
            return items.map((item, index, array) => mapFn(item, index, array));
        } else {
            // For simple expressions, wrap in function body
            const mapFn = new Function('item', 'index', 'array', `
                'use strict';
                return (${expression});
            `);
            return items.map((item, index, array) => mapFn(item, index, array));
        }
    } catch (error: any) {
        throw new Error(`Map expression failed: ${error.message}`);
    }
}

// Apply filter expression to items
export function applyFilter(items: any[], expression: string): any[] {
    try {
        // Check if expression is an arrow function or simple expression
        const isArrowFunction = expression.includes('=>');

        if (isArrowFunction) {
            // For arrow functions, evaluate the function and call it
            const filterFn = new Function('item', 'index', 'array', `
                'use strict';
                const fn = ${expression};
                return Boolean(fn(item, index, array));
            `);
            return items.filter((item, index, array) => filterFn(item, index, array));
        } else {
            // For simple expressions, wrap in function body
            const filterFn = new Function('item', 'index', 'array', `
                'use strict';
                return Boolean(${expression});
            `);
            return items.filter((item, index, array) => filterFn(item, index, array));
        }
    } catch (error: any) {
        throw new Error(`Filter expression failed: ${error.message}`);
    }
}

// Main execution function
export async function main(): Promise<void> {
    try {
        // 1. Read input
        const input: LoopInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Get items array
        let items = [...config.items];
        const originalCount = items.length;

        // 4. Apply filter if provided
        if (config.filterExpression) {
            validateExpression(config.filterExpression);
            items = applyFilter(items, config.filterExpression);
        }

        // 5. Apply map if provided
        if (config.mapExpression) {
            validateExpression(config.mapExpression);
            items = applyMap(items, config.mapExpression);
        }

        // 6. Build output with port routing
        const output: BlockResult = {
            data: {
                results: items,
                count: items.length,
                originalCount,
            },
            port: items.length > 0 ? "default" : "empty",
        };

        // 7. Write output
        await Bun.write(Bun.stdout, JSON.stringify(output));

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Loop Block Failed: ${message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
