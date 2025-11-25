// pkg/blocks/std/file.ts
// Standard Block: File Operations
// Provides file system operations: read, write, delete, exists

import { stdin, stdout } from "bun";



// Type definitions for file operations
export type FileOperation =
    | { type: 'read'; format?: 'text' | 'json' | 'bytes' }
    | { type: 'write'; content: string | object }
    | { type: 'delete' }
    | { type: 'exists' };

export interface FileConfig {
    path: string;              // Absolute or relative file path
    operation: FileOperation;  // Operation to perform
}

export interface FileInput {
    config: FileConfig;
    input?: any;               // Data from previous blocks
}

export type FileOutput =
    | { operation: 'read'; data: string | object | Uint8Array; size: number }
    | { operation: 'write'; path: string; bytesWritten: number }
    | { operation: 'delete'; path: string; deleted: boolean }
    | { operation: 'exists'; path: string; exists: boolean };

// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (!config.path || typeof config.path !== 'string') {
        throw new Error("Config 'path' must be a non-empty string");
    }

    if (!config.operation) {
        throw new Error("Missing required config: operation");
    }

    const op = config.operation;
    if (!op.type) {
        throw new Error("Operation must have a 'type' field");
    }

    const validTypes = ['read', 'write', 'delete', 'exists'];
    if (!validTypes.includes(op.type)) {
        throw new Error(`Invalid operation type: ${op.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate operation-specific fields
    if (op.type === 'read' && op.format !== undefined) {
        const validFormats = ['text', 'json', 'bytes'];
        if (!validFormats.includes(op.format)) {
            throw new Error(`Invalid read format: ${op.format}. Must be one of: ${validFormats.join(', ')}`);
        }
    }

    if (op.type === 'write' && op.content === undefined) {
        throw new Error("Write operation requires 'content' field");
    }
}

// Execute read operation
export async function executeRead(path: string, format: 'text' | 'json' | 'bytes' = 'text'): Promise<any> {
    const file = Bun.file(path);

    // Check if file exists
    const exists = await file.exists();
    if (!exists) {
        throw new Error(`File not found: ${path}`);
    }

    // Get file size for output
    const size = file.size;

    // Read file based on format
    let data: any;
    try {
        switch (format) {
            case 'text':
                data = await file.text();
                break;
            case 'json':
                data = await file.json();
                break;
            case 'bytes':
                data = await file.bytes();
                break;
        }
    } catch (error: any) {
        if (format === 'json') {
            throw new Error(`Failed to parse JSON from file: ${error.message}`);
        }
        throw new Error(`Failed to read file: ${error.message}`);
    }

    return { data, size };
}

// Execute write operation
export async function executeWrite(path: string, content: string | object): Promise<{ path: string; bytesWritten: number }> {
    try {
        // Convert object to JSON string if needed
        const writeContent = typeof content === 'object'
            ? JSON.stringify(content, null, 2)
            : content;

        // Write file using Bun.write
        const bytesWritten = await Bun.write(path, writeContent);

        return { path, bytesWritten };
    } catch (error: any) {
        throw new Error(`Failed to write file: ${error.message}`);
    }
}

// Execute delete operation
export async function executeDelete(path: string): Promise<{ path: string; deleted: boolean }> {
    try {
        const file = Bun.file(path);

        // Check if file exists before attempting delete
        const exists = await file.exists();
        if (!exists) {
            throw new Error(`File not found: ${path}`);
        }

        // Delete the file
        await file.delete();

        return { path, deleted: true };
    } catch (error: any) {
        if (error.message.includes('File not found')) {
            throw error;
        }
        throw new Error(`Failed to delete file: ${error.message}`);
    }
}

// Execute exists operation
export async function executeExists(path: string): Promise<{ path: string; exists: boolean }> {
    try {
        const file = Bun.file(path);
        const exists = await file.exists();

        return { path, exists };
    } catch (error: any) {
        throw new Error(`Failed to check file existence: ${error.message}`);
    }
}

// Main execution function
export async function main() {
    try {
        // 1. Read input
        const input: FileInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute operation based on type
        let result: FileOutput;
        const { path, operation } = config;

        switch (operation.type) {
            case 'read': {
                const format = operation.format || 'text';
                const { data, size } = await executeRead(path, format);
                result = { operation: 'read', data, size };
                break;
            }
            case 'write': {
                const { path: writtenPath, bytesWritten } = await executeWrite(path, operation.content);
                result = { operation: 'write', path: writtenPath, bytesWritten };
                break;
            }
            case 'delete': {
                const { path: deletedPath, deleted } = await executeDelete(path);
                result = { operation: 'delete', path: deletedPath, deleted };
                break;
            }
            case 'exists': {
                const { path: checkedPath, exists } = await executeExists(path);
                result = { operation: 'exists', path: checkedPath, exists };
                break;
            }
            default:
                throw new Error(`Unknown operation type: ${(operation as any).type}`);
        }

        // 4. Write output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error: any) {
        console.error(`File Block Failed: ${error.message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
