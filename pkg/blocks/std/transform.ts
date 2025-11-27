// pkg/blocks/std/transform.ts
// Standard Block: Data Transformation
// Provides JSONPath queries, field mapping, renaming, and type conversion.

import { query as jsonpathQuery } from "jsonpath-rfc9535";

// Type definitions for transformation operations
export type TransformOperation =
    | { type: "pick"; fields: string[] }
    | { type: "rename"; mapping: Record<string, string> }
    | { type: "map"; expression: string }
    | { type: "jsonpath"; query: string };

export interface TransformConfig {
    input?: unknown;                     // Input data to transform
    operations: TransformOperation[];    // Array of operations to apply sequentially
}

export interface TransformInput {
    config: TransformConfig;
    input?: unknown;                     // Data from previous blocks
}

export interface TransformOutput {
    data: unknown;                       // Transformed result
    operationsApplied: number;           // Number of operations executed
}

export interface BlockResult {
    data: TransformOutput;
    port: string;
}

// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (!config.operations || !Array.isArray(config.operations)) {
        throw new Error("Config 'operations' must be an array");
    }

    if (config.operations.length === 0) {
        throw new Error("At least one operation is required");
    }

    // Validate each operation
    for (const op of config.operations) {
        if (!op.type) {
            throw new Error("Each operation must have a 'type' field");
        }

        switch (op.type) {
            case 'pick':
                if (!Array.isArray(op.fields)) {
                    throw new Error("'pick' operation requires 'fields' array");
                }
                break;
            case 'rename':
                if (!op.mapping || typeof op.mapping !== 'object') {
                    throw new Error("'rename' operation requires 'mapping' object");
                }
                break;
            case 'map':
                if (typeof op.expression !== 'string') {
                    throw new Error("'map' operation requires 'expression' string");
                }
                break;
            case 'jsonpath':
                if (typeof op.query !== 'string') {
                    throw new Error("'jsonpath' operation requires 'query' string");
                }
                break;
            default:
                throw new Error(`Unknown operation type: ${op.type}`);
        }
    }
}

// Apply 'pick' operation - select specific fields from object
export function applyPick(data: any, fields: string[]): any {
    if (typeof data !== 'object' || data === null) {
        throw new Error("'pick' operation requires an object");
    }

    const result: any = {};
    for (const field of fields) {
        if (field in data) {
            result[field] = data[field];
        }
    }
    return result;
}

// Apply 'rename' operation - rename object keys
export function applyRename(data: any, mapping: Record<string, string>): any {
    if (typeof data !== 'object' || data === null) {
        throw new Error("'rename' operation requires an object");
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
        const newKey = mapping[key] || key;
        result[newKey] = value;
    }
    return result;
}

// Apply 'map' operation - transform data using expression
export function applyMap(data: any, expression: string): any {
    try {
        // Create transformation function
        const mapFn = new Function('data', `
            'use strict';
            return (${expression});
        `);
        return mapFn(data);
    } catch (error: any) {
        throw new Error(`Map expression failed: ${error.message}`);
    }
}

// Apply 'jsonpath' operation - query data using JSONPath
export function applyJSONPath(data: any, queryString: string): any {
    try {
        const result = jsonpathQuery(data, queryString);

        // If result is array with single element, unwrap it
        if (Array.isArray(result) && result.length === 1) {
            return result[0];
        }

        return result;
    } catch (error: any) {
        throw new Error(`JSONPath query failed: ${error.message}`);
    }
}

// Main execution function
export async function main(): Promise<void> {
    try {
        // 1. Read input
        const input: TransformInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Get input data
        // Use config.input if provided, otherwise use input.input from previous blocks
        let data: unknown = config.input !== undefined ? config.input : (input.input ?? {});

        // 4. Apply operations sequentially
        let operationsApplied = 0;
        for (const operation of config.operations) {
            switch (operation.type) {
                case "pick":
                    data = applyPick(data, operation.fields);
                    break;
                case "rename":
                    data = applyRename(data, operation.mapping);
                    break;
                case "map":
                    data = applyMap(data, operation.expression);
                    break;
                case "jsonpath":
                    data = applyJSONPath(data, operation.query);
                    break;
            }
            operationsApplied++;
        }

        // 5. Build output with port routing
        const output: BlockResult = {
            data: {
                data,
                operationsApplied,
            },
            port: "default",
        };

        // 6. Write output
        await Bun.write(Bun.stdout, JSON.stringify(output));

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Transform Block Failed: ${message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
