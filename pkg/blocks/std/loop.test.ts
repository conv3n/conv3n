// pkg/blocks/std/loop.test.ts
// Unit tests for Loop block

import { describe, test, expect } from "bun:test";
import {
    validateConfig,
    validateExpression,
    applyMap,
    applyFilter,
    type LoopConfig,
} from "./loop";

describe("Loop Block", () => {
    describe("validateConfig", () => {
        test("should pass for valid config with items array", () => {
            const config = { items: [1, 2, 3] };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when config is missing", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when items is not an array", () => {
            const config = { items: "not an array" };
            expect(() => validateConfig(config)).toThrow("Config 'items' must be an array");
        });

        test("should throw error when items is missing", () => {
            const config = {};
            expect(() => validateConfig(config)).toThrow("Config 'items' must be an array");
        });

        test("should pass with empty array", () => {
            const config = { items: [] };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass with optional map expression", () => {
            const config = { items: [1, 2, 3], mapExpression: "item * 2" };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass with optional filter expression", () => {
            const config = { items: [1, 2, 3], filterExpression: "item > 1" };
            expect(() => validateConfig(config)).not.toThrow();
        });

    });

    describe("validateExpression", () => {
        test("should pass for valid simple expression", () => {
            expect(() => validateExpression("item * 2")).not.toThrow();
        });

        test("should pass for valid arrow function", () => {
            expect(() => validateExpression("item => item * 2")).not.toThrow();
        });

        test("should pass for complex expression", () => {
            expect(() => validateExpression("item.value > 10 && item.active")).not.toThrow();
        });

        test("should throw error for invalid syntax", () => {
            expect(() => validateExpression("item *")).toThrow("Invalid expression syntax");
        });
    });

    describe("applyMap", () => {
        test("should map simple numbers", () => {
            const items = [1, 2, 3, 4, 5];
            const result = applyMap(items, "item * 2");
            expect(result).toEqual([2, 4, 6, 8, 10]);
        });

        test("should map with arrow function", () => {
            const items = [1, 2, 3];
            const result = applyMap(items, "item => item + 10");
            expect(result).toEqual([11, 12, 13]);
        });

        test("should map objects", () => {
            const items = [{ value: 1 }, { value: 2 }, { value: 3 }];
            const result = applyMap(items, "({ ...item, doubled: item.value * 2 })");
            expect(result).toEqual([
                { value: 1, doubled: 2 },
                { value: 2, doubled: 4 },
                { value: 3, doubled: 6 },
            ]);
        });

        test("should have access to index", () => {
            const items = ["a", "b", "c"];
            const result = applyMap(items, "`${item}-${index}`");
            expect(result).toEqual(["a-0", "b-1", "c-2"]);
        });

        test("should handle empty array", () => {
            const items: any[] = [];
            const result = applyMap(items, "item * 2");
            expect(result).toEqual([]);
        });

        test("should map strings", () => {
            const items = ["hello", "world"];
            const result = applyMap(items, "item.toUpperCase()");
            expect(result).toEqual(["HELLO", "WORLD"]);
        });

        test("should throw error for invalid expression", () => {
            const items = [1, 2, 3];
            expect(() => applyMap(items, "item.nonexistent.property")).toThrow("Map expression failed");
        });
    });

    describe("applyFilter", () => {
        test("should filter numbers", () => {
            const items = [1, 2, 3, 4, 5];
            const result = applyFilter(items, "item > 3");
            expect(result).toEqual([4, 5]);
        });

        test("should filter with arrow function", () => {
            const items = [1, 2, 3, 4, 5];
            const result = applyFilter(items, "item => item % 2 === 0");
            expect(result).toEqual([2, 4]);
        });

        test("should filter objects", () => {
            const items = [
                { name: "Alice", age: 25 },
                { name: "Bob", age: 17 },
                { name: "Charlie", age: 30 },
            ];
            const result = applyFilter(items, "item.age >= 18");
            expect(result).toEqual([
                { name: "Alice", age: 25 },
                { name: "Charlie", age: 30 },
            ]);
        });

        test("should have access to index", () => {
            const items = [10, 20, 30, 40];
            const result = applyFilter(items, "index < 2");
            expect(result).toEqual([10, 20]);
        });

        test("should handle empty array", () => {
            const items: any[] = [];
            const result = applyFilter(items, "item > 0");
            expect(result).toEqual([]);
        });

        test("should filter strings", () => {
            const items = ["apple", "banana", "apricot", "cherry"];
            const result = applyFilter(items, "item.startsWith('a')");
            expect(result).toEqual(["apple", "apricot"]);
        });

        test("should return empty array when no items match", () => {
            const items = [1, 2, 3];
            const result = applyFilter(items, "item > 10");
            expect(result).toEqual([]);
        });

        test("should throw error for invalid expression", () => {
            const items = [1, 2, 3];
            expect(() => applyFilter(items, "item.nonexistent.property")).toThrow("Filter expression failed");
        });
    });

    describe("combined operations", () => {
        test("should apply filter then map", () => {
            let items = [1, 2, 3, 4, 5];
            items = applyFilter(items, "item > 2");
            items = applyMap(items, "item * 10");
            expect(items).toEqual([30, 40, 50]);
        });

        test("should handle complex transformations", () => {
            const items = [
                { name: "Product A", price: 100, inStock: true },
                { name: "Product B", price: 50, inStock: false },
                { name: "Product C", price: 150, inStock: true },
            ];

            let result = applyFilter(items, "item.inStock");
            result = applyMap(result, "({ ...item, discountedPrice: item.price * 0.9 })");

            expect(result).toEqual([
                { name: "Product A", price: 100, inStock: true, discountedPrice: 90 },
                { name: "Product C", price: 150, inStock: true, discountedPrice: 135 },
            ]);
        });
    });
});
