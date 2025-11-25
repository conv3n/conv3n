// pkg/blocks/std/file.test.ts
// Unit tests for File block

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
    validateConfig,
    executeRead,
    executeWrite,
    executeDelete,
    executeExists,
    type FileConfig,
} from "./file";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";

// Test directory for file operations
const TEST_DIR = "/tmp/conv3n_file_tests";

describe("File Block", () => {
    // Setup and cleanup test directory
    beforeEach(() => {
        try {
            mkdirSync(TEST_DIR, { recursive: true });
        } catch (e) {
            // Directory might already exist
        }
    });

    afterEach(() => {
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe("validateConfig", () => {
        test("should pass for valid read config", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'read' as const }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid write config", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'write' as const, content: "Hello" }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid delete config", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'delete' as const }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid exists config", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'exists' as const }
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when config is missing", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when path is missing", () => {
            const config = {
                operation: { type: 'read' as const }
            };
            expect(() => validateConfig(config)).toThrow("Config 'path' must be a non-empty string");
        });

        test("should throw error when path is not a string", () => {
            const config = {
                path: 123,
                operation: { type: 'read' as const }
            };
            expect(() => validateConfig(config)).toThrow("Config 'path' must be a non-empty string");
        });

        test("should throw error when operation is missing", () => {
            const config = {
                path: "/tmp/test.txt"
            };
            expect(() => validateConfig(config)).toThrow("Missing required config: operation");
        });

        test("should throw error when operation type is missing", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: {}
            };
            expect(() => validateConfig(config)).toThrow("Operation must have a 'type' field");
        });

        test("should throw error for invalid operation type", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'invalid' }
            };
            expect(() => validateConfig(config)).toThrow("Invalid operation type: invalid");
        });

        test("should throw error for invalid read format", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'read' as const, format: 'xml' }
            };
            expect(() => validateConfig(config)).toThrow("Invalid read format: xml");
        });

        test("should throw error when write operation missing content", () => {
            const config = {
                path: "/tmp/test.txt",
                operation: { type: 'write' as const }
            };
            expect(() => validateConfig(config)).toThrow("Write operation requires 'content' field");
        });
    });

    describe("executeRead", () => {
        test("should read text file", async () => {
            const path = join(TEST_DIR, "test.txt");
            await Bun.write(path, "Hello, World!");

            const result = await executeRead(path, 'text');

            expect(result.data).toBe("Hello, World!");
            expect(result.size).toBe(13);
        });

        test("should read JSON file", async () => {
            const path = join(TEST_DIR, "test.json");
            const jsonData = { message: "Hello", count: 42 };
            await Bun.write(path, JSON.stringify(jsonData));

            const result = await executeRead(path, 'json');

            expect(result.data).toEqual(jsonData);
            expect(result.size).toBeGreaterThan(0);
        });

        test("should read bytes (binary)", async () => {
            const path = join(TEST_DIR, "test.bin");
            const binaryData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
            await Bun.write(path, binaryData);

            const result = await executeRead(path, 'bytes');

            expect(result.data).toBeInstanceOf(Uint8Array);
            expect(result.data).toEqual(binaryData);
            expect(result.size).toBe(5);
        });

        test("should throw error for non-existent file", async () => {
            const path = join(TEST_DIR, "nonexistent.txt");

            await expect(executeRead(path, 'text')).rejects.toThrow("File not found");
        });



        test("should throw error for invalid JSON format", async () => {
            const path = join(TEST_DIR, "invalid.json");
            await Bun.write(path, "{ invalid json }");

            await expect(executeRead(path, 'json')).rejects.toThrow("Failed to parse JSON");
        });

        test("should read empty file", async () => {
            const path = join(TEST_DIR, "empty.txt");
            await Bun.write(path, "");

            const result = await executeRead(path, 'text');

            expect(result.data).toBe("");
            expect(result.size).toBe(0);
        });

        test("should read file with special characters", async () => {
            const path = join(TEST_DIR, "special.txt");
            const specialContent = "Hello 🌍! Привет мир! 你好世界!";
            await Bun.write(path, specialContent);

            const result = await executeRead(path, 'text');

            expect(result.data).toBe(specialContent);
        });

        test("should default to text format when not specified", async () => {
            const path = join(TEST_DIR, "default.txt");
            await Bun.write(path, "Default format");

            const result = await executeRead(path);

            expect(result.data).toBe("Default format");
        });
    });

    describe("executeWrite", () => {
        test("should write text content", async () => {
            const path = join(TEST_DIR, "write_text.txt");
            const content = "Hello from Bun!";

            const result = await executeWrite(path, content);

            expect(result.path).toBe(path);
            expect(result.bytesWritten).toBeGreaterThan(0);

            // Verify file was written
            const file = Bun.file(path);
            const readContent = await file.text();
            expect(readContent).toBe(content);
        });

        test("should write JSON object", async () => {
            const path = join(TEST_DIR, "write_json.json");
            const content = { message: "Hello", timestamp: "2025-11-25" };

            const result = await executeWrite(path, content);

            expect(result.path).toBe(path);
            expect(result.bytesWritten).toBeGreaterThan(0);

            // Verify file was written as formatted JSON
            const file = Bun.file(path);
            const readContent = await file.json();
            expect(readContent).toEqual(content);
        });

        test("should create new file", async () => {
            const path = join(TEST_DIR, "new_file.txt");

            // Ensure file doesn't exist
            const fileBefore = Bun.file(path);
            expect(await fileBefore.exists()).toBe(false);

            await executeWrite(path, "New content");

            // Verify file was created
            const fileAfter = Bun.file(path);
            expect(await fileAfter.exists()).toBe(true);
        });

        test("should overwrite existing file", async () => {
            const path = join(TEST_DIR, "overwrite.txt");

            // Create initial file
            await Bun.write(path, "Original content");

            // Overwrite
            await executeWrite(path, "New content");

            // Verify content was overwritten
            const file = Bun.file(path);
            const content = await file.text();
            expect(content).toBe("New content");
        });

        test("should handle empty string content", async () => {
            const path = join(TEST_DIR, "empty_write.txt");

            const result = await executeWrite(path, "");

            expect(result.bytesWritten).toBe(0);
        });
    });

    describe("executeDelete", () => {
        test("should delete existing file", async () => {
            const path = join(TEST_DIR, "delete_me.txt");
            await Bun.write(path, "To be deleted");

            const result = await executeDelete(path);

            expect(result.path).toBe(path);
            expect(result.deleted).toBe(true);

            // Verify file was deleted
            const file = Bun.file(path);
            expect(await file.exists()).toBe(false);
        });

        test("should throw error for non-existent file", async () => {
            const path = join(TEST_DIR, "nonexistent_delete.txt");

            await expect(executeDelete(path)).rejects.toThrow("File not found");
        });

        test("should verify file removal", async () => {
            const path = join(TEST_DIR, "verify_delete.txt");
            await Bun.write(path, "Content");

            // File exists before delete
            const fileBefore = Bun.file(path);
            expect(await fileBefore.exists()).toBe(true);

            await executeDelete(path);

            // File doesn't exist after delete
            const fileAfter = Bun.file(path);
            expect(await fileAfter.exists()).toBe(false);
        });
    });

    describe("executeExists", () => {
        test("should return true for existing file", async () => {
            const path = join(TEST_DIR, "exists.txt");
            await Bun.write(path, "I exist");

            const result = await executeExists(path);

            expect(result.path).toBe(path);
            expect(result.exists).toBe(true);
        });

        test("should return false for non-existent file", async () => {
            const path = join(TEST_DIR, "does_not_exist.txt");

            const result = await executeExists(path);

            expect(result.path).toBe(path);
            expect(result.exists).toBe(false);
        });

        test("should return false for directory", async () => {
            const result = await executeExists(TEST_DIR);

            expect(result.exists).toBe(false);
        });
    });

    describe("edge cases", () => {
        test("should handle file with no extension", async () => {
            const path = join(TEST_DIR, "noextension");
            await Bun.write(path, "No extension");

            const result = await executeRead(path, 'text');

            expect(result.data).toBe("No extension");
        });

        test("should handle file with multiple dots", async () => {
            const path = join(TEST_DIR, "file.backup.txt");
            await Bun.write(path, "Multiple dots");

            const result = await executeRead(path, 'text');

            expect(result.data).toBe("Multiple dots");
        });

        test("should handle nested directory paths", async () => {
            const nestedDir = join(TEST_DIR, "nested", "deep");
            mkdirSync(nestedDir, { recursive: true });
            const path = join(nestedDir, "file.txt");

            await executeWrite(path, "Nested file");

            const result = await executeRead(path, 'text');
            expect(result.data).toBe("Nested file");
        });



        test("should handle complex JSON structures", async () => {
            const path = join(TEST_DIR, "complex.json");
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { key: "value" }
                },
                nullValue: null,
                boolValue: true
            };
            await Bun.write(path, JSON.stringify(complexData));

            const result = await executeRead(path, 'json');

            expect(result.data).toEqual(complexData);
        });
    });
});
