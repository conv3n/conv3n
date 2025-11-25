// pkg/blocks/std/database.ts
// Standard Block: Database Operations
// Provides SQLite operations via native bun:sqlite module

import { stdin, stdout } from "bun";
import { Database } from "bun:sqlite";

// Maximum number of rows to prevent DoS attacks and memory exhaustion
const MAX_RESULT_ROWS = 10000;

// Type definitions for database operations
export type DatabaseOperation =
    | { type: 'query'; sql: string; params?: any[] }           // SELECT queries
    | { type: 'execute'; sql: string; params?: any[] }         // INSERT/UPDATE/DELETE
    | { type: 'transaction'; statements: Array<{ sql: string; params?: any[] }> };

export interface DatabaseConfig {
    database: string;           // Path to SQLite file or ":memory:"
    operation: DatabaseOperation;
}

export interface DatabaseInput {
    config: DatabaseConfig;
    input?: any;                // Data from previous blocks
}

export type DatabaseOutput =
    | { operation: 'query'; rows: any[]; rowCount: number }
    | { operation: 'execute'; changes: number; lastInsertRowid: number }
    | { operation: 'transaction'; statementsExecuted: number; changes: number };

// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (!config.database || typeof config.database !== 'string') {
        throw new Error("Config 'database' must be a non-empty string");
    }

    if (!config.operation) {
        throw new Error("Missing required config: operation");
    }

    const op = config.operation;
    if (!op.type) {
        throw new Error("Operation must have a 'type' field");
    }

    const validTypes = ['query', 'execute', 'transaction'];
    if (!validTypes.includes(op.type)) {
        throw new Error(`Invalid operation type: ${op.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate operation-specific fields
    if (op.type === 'query' || op.type === 'execute') {
        if (!op.sql || typeof op.sql !== 'string') {
            throw new Error(`${op.type} operation requires 'sql' string`);
        }
        if (op.params !== undefined && !Array.isArray(op.params)) {
            throw new Error("Operation 'params' must be an array");
        }
    }

    if (op.type === 'transaction') {
        if (!op.statements || !Array.isArray(op.statements)) {
            throw new Error("Transaction operation requires 'statements' array");
        }
        if (op.statements.length === 0) {
            throw new Error("Transaction must have at least one statement");
        }
        for (const stmt of op.statements) {
            if (!stmt.sql || typeof stmt.sql !== 'string') {
                throw new Error("Each transaction statement must have 'sql' string");
            }
            if (stmt.params !== undefined && !Array.isArray(stmt.params)) {
                throw new Error("Statement 'params' must be an array");
            }
        }
    }
}

// Execute query operation (SELECT)
export function executeQuery(db: Database, sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    try {
        // Prepare and execute query
        const stmt = db.query(sql);
        const rows = params ? stmt.all(...params) : stmt.all();

        // Check row count to prevent DoS
        if (rows.length > MAX_RESULT_ROWS) {
            throw new Error(
                `Query returned ${rows.length} rows, exceeding maximum allowed (${MAX_RESULT_ROWS})`
            );
        }

        return { rows, rowCount: rows.length };
    } catch (error: any) {
        // Enhance error message for SQL errors
        if (error.message.includes('exceeding maximum')) {
            throw error;
        }
        throw new Error(`SQL query failed: ${error.message}`);
    }
}

// Execute operation (INSERT/UPDATE/DELETE)
export function executeStatement(db: Database, sql: string, params?: any[]): { changes: number; lastInsertRowid: number } {
    try {
        // Prepare and execute statement
        const stmt = db.query(sql);
        const result = params ? stmt.run(...params) : stmt.run();

        return {
            changes: result.changes,
            lastInsertRowid: Number(result.lastInsertRowid)
        };
    } catch (error: any) {
        throw new Error(`SQL execution failed: ${error.message}`);
    }
}

// Execute transaction (multiple statements atomically)
export function executeTransaction(
    db: Database,
    statements: Array<{ sql: string; params?: any[] }>
): { statementsExecuted: number; changes: number } {
    let totalChanges = 0;
    let statementsExecuted = 0;

    try {
        // Use Bun's transaction API for atomic execution
        db.transaction(() => {
            for (const stmt of statements) {
                const result = executeStatement(db, stmt.sql, stmt.params);
                totalChanges += result.changes;
                statementsExecuted++;
            }
        })();

        return { statementsExecuted, changes: totalChanges };
    } catch (error: any) {
        throw new Error(`Transaction failed: ${error.message}`);
    }
}

// Main execution function
export async function main() {
    let db: Database | null = null;

    try {
        // 1. Read input
        const input: DatabaseInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Open database connection
        try {
            db = new Database(config.database);
        } catch (error: any) {
            throw new Error(`Failed to open database: ${error.message}`);
        }

        // 4. Execute operation based on type
        let result: DatabaseOutput;
        const { operation } = config;

        switch (operation.type) {
            case 'query': {
                const { rows, rowCount } = executeQuery(db, operation.sql, operation.params);
                result = { operation: 'query', rows, rowCount };
                break;
            }
            case 'execute': {
                const { changes, lastInsertRowid } = executeStatement(db, operation.sql, operation.params);
                result = { operation: 'execute', changes, lastInsertRowid };
                break;
            }
            case 'transaction': {
                const { statementsExecuted, changes } = executeTransaction(db, operation.statements);
                result = { operation: 'transaction', statementsExecuted, changes };
                break;
            }
            default:
                throw new Error(`Unknown operation type: ${(operation as any).type}`);
        }

        // 5. Write output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error: any) {
        console.error(`Database Block Failed: ${error.message}`);
        process.exit(1);
    } finally {
        // 6. Close database connection
        if (db) {
            try {
                db.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
