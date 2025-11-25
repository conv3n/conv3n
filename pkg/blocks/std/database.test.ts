// pkg/blocks/std/database.test.ts
// Unit tests for Database block

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
    validateConfig,
    executeQuery,
    executeStatement,
    executeTransaction,
    type DatabaseConfig,
} from "./database";
import { Database } from "bun:sqlite";

describe("Database Block", () => {
    let db: Database;

    // Setup in-memory database for each test
    beforeEach(() => {
        db = new Database(":memory:");
    });

    // Cleanup database after each test
    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    describe("validateConfig", () => {
        test("should pass for valid query config", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'query' as const, sql: "SELECT 1" }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid execute config", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'execute' as const, sql: "INSERT INTO users VALUES (1)" }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid transaction config", () => {
            const config = {
                database: ":memory:",
                operation: {
                    type: 'transaction' as const,
                    statements: [
                        { sql: "INSERT INTO users VALUES (1)" },
                        { sql: "INSERT INTO users VALUES (2)" }
                    ]
                }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when config is missing", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when database is missing", () => {
            const config = {
                operation: { type: 'query' as const, sql: "SELECT 1" }
            };
            expect(() => validateConfig(config)).toThrow("Config 'database' must be a non-empty string");
        });

        test("should throw error when operation is missing", () => {
            const config = {
                database: ":memory:"
            };
            expect(() => validateConfig(config)).toThrow("Missing required config: operation");
        });

        test("should throw error when operation type is missing", () => {
            const config = {
                database: ":memory:",
                operation: { sql: "SELECT 1" }
            };
            expect(() => validateConfig(config)).toThrow("Operation must have a 'type' field");
        });

        test("should throw error for invalid operation type", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'invalid', sql: "SELECT 1" }
            };
            expect(() => validateConfig(config)).toThrow("Invalid operation type: invalid");
        });

        test("should throw error when query missing sql", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'query' as const }
            };
            expect(() => validateConfig(config)).toThrow("query operation requires 'sql' string");
        });

        test("should throw error when params is not an array", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'query' as const, sql: "SELECT ?", params: "invalid" }
            };
            expect(() => validateConfig(config)).toThrow("Operation 'params' must be an array");
        });

        test("should throw error when transaction has no statements", () => {
            const config = {
                database: ":memory:",
                operation: { type: 'transaction' as const, statements: [] }
            };
            expect(() => validateConfig(config)).toThrow("Transaction must have at least one statement");
        });

        test("should throw error when transaction statement missing sql", () => {
            const config = {
                database: ":memory:",
                operation: {
                    type: 'transaction' as const,
                    statements: [{ params: [] }]
                }
            };
            expect(() => validateConfig(config)).toThrow("Each transaction statement must have 'sql' string");
        });
    });

    describe("executeQuery", () => {
        beforeEach(() => {
            // Create test table
            db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)");
            db.run("INSERT INTO users (name, age) VALUES ('Alice', 30)");
            db.run("INSERT INTO users (name, age) VALUES ('Bob', 25)");
            db.run("INSERT INTO users (name, age) VALUES ('Charlie', 35)");
        });

        test("should execute simple SELECT query", () => {
            const result = executeQuery(db, "SELECT * FROM users");

            expect(result.rowCount).toBe(3);
            expect(result.rows).toHaveLength(3);
            expect(result.rows[0]).toHaveProperty('name');
        });

        test("should execute SELECT with WHERE clause", () => {
            const result = executeQuery(db, "SELECT * FROM users WHERE age > 25");

            expect(result.rowCount).toBe(2);
            expect(result.rows).toHaveLength(2);
        });

        test("should execute parameterized query", () => {
            const result = executeQuery(db, "SELECT * FROM users WHERE name = ?", ['Alice']);

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].name).toBe('Alice');
            expect(result.rows[0].age).toBe(30);
        });

        test("should return empty result for no matches", () => {
            const result = executeQuery(db, "SELECT * FROM users WHERE name = 'NonExistent'");

            expect(result.rowCount).toBe(0);
            expect(result.rows).toHaveLength(0);
        });

        test("should throw error for SQL syntax error", () => {
            expect(() => {
                executeQuery(db, "SELCT * FROM users");
            }).toThrow("SQL query failed");
        });

        test("should execute SELECT with JOIN", () => {
            // Create another table
            db.run("CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, amount REAL)");
            db.run("INSERT INTO orders (user_id, amount) VALUES (1, 100.50)");

            const result = executeQuery(
                db,
                "SELECT users.name, orders.amount FROM users JOIN orders ON users.id = orders.user_id"
            );

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].name).toBe('Alice');
            expect(result.rows[0].amount).toBe(100.50);
        });

        test("should handle multiple parameters", () => {
            const result = executeQuery(
                db,
                "SELECT * FROM users WHERE age > ? AND age < ?",
                [25, 35]
            );

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].name).toBe('Alice');
        });
    });

    describe("executeStatement", () => {
        beforeEach(() => {
            db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)");
        });

        test("should execute INSERT statement", () => {
            const result = executeStatement(db, "INSERT INTO users (name, age) VALUES ('Alice', 30)");

            expect(result.changes).toBe(1);
            expect(result.lastInsertRowid).toBeGreaterThan(0);
        });

        test("should execute INSERT with parameters", () => {
            const result = executeStatement(
                db,
                "INSERT INTO users (name, age) VALUES (?, ?)",
                ['Bob', 25]
            );

            expect(result.changes).toBe(1);
            expect(result.lastInsertRowid).toBeGreaterThan(0);

            // Verify insertion
            const rows = db.query("SELECT * FROM users WHERE name = 'Bob'").all();
            expect(rows).toHaveLength(1);
        });

        test("should execute UPDATE statement", () => {
            db.run("INSERT INTO users (name, age) VALUES ('Alice', 30)");

            const result = executeStatement(db, "UPDATE users SET age = 31 WHERE name = 'Alice'");

            expect(result.changes).toBe(1);
        });

        test("should execute DELETE statement", () => {
            db.run("INSERT INTO users (name, age) VALUES ('Alice', 30)");
            db.run("INSERT INTO users (name, age) VALUES ('Bob', 25)");

            const result = executeStatement(db, "DELETE FROM users WHERE name = 'Alice'");

            expect(result.changes).toBe(1);

            // Verify deletion
            const rows = db.query("SELECT * FROM users").all();
            expect(rows).toHaveLength(1);
        });

        test("should throw error for constraint violation", () => {
            db.run("CREATE UNIQUE INDEX idx_name ON users(name)");
            db.run("INSERT INTO users (name, age) VALUES ('Alice', 30)");

            expect(() => {
                executeStatement(db, "INSERT INTO users (name, age) VALUES ('Alice', 25)");
            }).toThrow("SQL execution failed");
        });

        test("should throw error for SQL syntax error", () => {
            expect(() => {
                executeStatement(db, "INSRT INTO users VALUES (1)");
            }).toThrow("SQL execution failed");
        });

        test("should return 0 changes for UPDATE with no matches", () => {
            const result = executeStatement(db, "UPDATE users SET age = 40 WHERE name = 'NonExistent'");

            expect(result.changes).toBe(0);
        });
    });

    describe("executeTransaction", () => {
        beforeEach(() => {
            db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)");
        });

        test("should execute successful transaction with multiple INSERTs", () => {
            const statements = [
                { sql: "INSERT INTO users (name, age) VALUES ('Alice', 30)" },
                { sql: "INSERT INTO users (name, age) VALUES ('Bob', 25)" },
                { sql: "INSERT INTO users (name, age) VALUES ('Charlie', 35)" }
            ];

            const result = executeTransaction(db, statements);

            expect(result.statementsExecuted).toBe(3);
            expect(result.changes).toBe(3);

            // Verify all rows were inserted
            const rows = db.query("SELECT * FROM users").all();
            expect(rows).toHaveLength(3);
        });

        test("should rollback transaction on error", () => {
            db.run("CREATE UNIQUE INDEX idx_name ON users(name)");

            const statements = [
                { sql: "INSERT INTO users (name, age) VALUES ('Alice', 30)" },
                { sql: "INSERT INTO users (name, age) VALUES ('Alice', 25)" } // Duplicate, will fail
            ];

            expect(() => {
                executeTransaction(db, statements);
            }).toThrow("Transaction failed");

            // Verify no rows were inserted (rollback)
            const rows = db.query("SELECT * FROM users").all();
            expect(rows).toHaveLength(0);
        });

        test("should execute transaction with mixed operations", () => {
            db.run("INSERT INTO users (name, age) VALUES ('Alice', 30)");

            const statements = [
                { sql: "INSERT INTO users (name, age) VALUES ('Bob', 25)" },
                { sql: "UPDATE users SET age = 31 WHERE name = 'Alice'" },
                { sql: "DELETE FROM users WHERE name = 'Bob'" }
            ];

            const result = executeTransaction(db, statements);

            expect(result.statementsExecuted).toBe(3);
            expect(result.changes).toBe(3);

            // Verify final state
            const rows = db.query("SELECT * FROM users").all();
            expect(rows).toHaveLength(1);
            expect((rows[0] as any).name).toBe('Alice');
            expect((rows[0] as any).age).toBe(31);
        });

        test("should execute transaction with parameterized statements", () => {
            const statements = [
                { sql: "INSERT INTO users (name, age) VALUES (?, ?)", params: ['Alice', 30] },
                { sql: "INSERT INTO users (name, age) VALUES (?, ?)", params: ['Bob', 25] }
            ];

            const result = executeTransaction(db, statements);

            expect(result.statementsExecuted).toBe(2);
            expect(result.changes).toBe(2);
        });

        test("should rollback on invalid SQL in transaction", () => {
            const statements = [
                { sql: "INSERT INTO users (name, age) VALUES ('Alice', 30)" },
                { sql: "INVALID SQL STATEMENT" }
            ];

            expect(() => {
                executeTransaction(db, statements);
            }).toThrow("Transaction failed");

            // Verify rollback
            const rows = db.query("SELECT * FROM users").all();
            expect(rows).toHaveLength(0);
        });
    });

    describe("edge cases", () => {
        test("should handle in-memory database", () => {
            const memDb = new Database(":memory:");
            memDb.run("CREATE TABLE test (id INTEGER)");
            memDb.run("INSERT INTO test VALUES (1)");

            const result = executeQuery(memDb, "SELECT * FROM test");

            expect(result.rowCount).toBe(1);
            memDb.close();
        });

        test("should handle NULL values", () => {
            db.run("CREATE TABLE test (id INTEGER, value TEXT)");
            db.run("INSERT INTO test VALUES (1, NULL)");

            const result = executeQuery(db, "SELECT * FROM test");

            expect(result.rows[0].value).toBeNull();
        });

        test("should handle empty string values", () => {
            db.run("CREATE TABLE test (id INTEGER, value TEXT)");
            executeStatement(db, "INSERT INTO test VALUES (?, ?)", [1, ""]);

            const result = executeQuery(db, "SELECT * FROM test");

            expect(result.rows[0].value).toBe("");
        });

        test("should handle special characters in strings", () => {
            db.run("CREATE TABLE test (id INTEGER, value TEXT)");
            const specialString = "Hello 'World' \"Test\" \\ 你好";
            executeStatement(db, "INSERT INTO test VALUES (?, ?)", [1, specialString]);

            const result = executeQuery(db, "SELECT * FROM test");

            expect((result.rows[0] as any).value).toBe(specialString);
        });

        test("should handle large numbers", () => {
            db.run("CREATE TABLE test (id INTEGER, bignum INTEGER)");
            const bigNum = 9007199254740991; // Max safe integer
            executeStatement(db, "INSERT INTO test VALUES (?, ?)", [1, bigNum]);

            const result = executeQuery(db, "SELECT * FROM test");

            expect((result.rows[0] as any).bignum).toBe(bigNum);
        });

        test("should handle floating point numbers", () => {
            db.run("CREATE TABLE test (id INTEGER, price REAL)");
            executeStatement(db, "INSERT INTO test VALUES (?, ?)", [1, 99.99]);

            const result = executeQuery(db, "SELECT * FROM test");

            expect(result.rows[0].price).toBe(99.99);
        });
    });
});
