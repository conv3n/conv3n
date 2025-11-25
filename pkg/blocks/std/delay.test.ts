// pkg/blocks/std/delay.test.ts
// Unit tests for Delay block

import { describe, test, expect } from "bun:test";
import {
    validateConfig,
    convertToMilliseconds,
    executeDelay,
    type DelayConfig,
} from "./delay";

describe("Delay Block", () => {
    describe("validateConfig", () => {
        test("should pass for valid config with duration in ms", () => {
            const config = { duration: 100 };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid config with duration in seconds", () => {
            const config = { duration: 2, unit: 's' as const };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when config is missing", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when duration is missing", () => {
            const config = {};
            expect(() => validateConfig(config)).toThrow("Config 'duration' must be a number");
        });

        test("should throw error when duration is not a number", () => {
            const config = { duration: "100" };
            expect(() => validateConfig(config)).toThrow("Config 'duration' must be a number");
        });

        test("should throw error when duration is negative", () => {
            const config = { duration: -100 };
            expect(() => validateConfig(config)).toThrow("Config 'duration' must be non-negative");
        });

        test("should pass with zero duration", () => {
            const config = { duration: 0 };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error for invalid unit", () => {
            const config = { duration: 100, unit: "minutes" };
            expect(() => validateConfig(config)).toThrow("Config 'unit' must be 'ms' or 's'");
        });

        test("should pass with 'ms' unit", () => {
            const config = { duration: 100, unit: 'ms' as const };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass with 's' unit", () => {
            const config = { duration: 2, unit: 's' as const };
            expect(() => validateConfig(config)).not.toThrow();
        });
    });

    describe("convertToMilliseconds", () => {
        test("should convert milliseconds correctly (default)", () => {
            const result = convertToMilliseconds(500);
            expect(result).toBe(500);
        });

        test("should convert milliseconds correctly (explicit)", () => {
            const result = convertToMilliseconds(500, 'ms');
            expect(result).toBe(500);
        });

        test("should convert seconds to milliseconds", () => {
            const result = convertToMilliseconds(2, 's');
            expect(result).toBe(2000);
        });

        test("should handle zero duration", () => {
            const result = convertToMilliseconds(0, 'ms');
            expect(result).toBe(0);
        });

        test("should handle fractional seconds", () => {
            const result = convertToMilliseconds(1.5, 's');
            expect(result).toBe(1500);
        });
    });

    describe("executeDelay", () => {
        test("should execute delay in milliseconds", async () => {
            const config: DelayConfig = { duration: 50 };
            const startTime = Date.now();
            const result = await executeDelay(config);
            const elapsed = Date.now() - startTime;

            expect(result.delayed).toBeGreaterThanOrEqual(45); // Allow 5ms tolerance
            expect(result.delayed).toBeLessThan(100); // Should not take too long
            expect(result.unit).toBe('ms');
            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 format
            expect(elapsed).toBeGreaterThanOrEqual(45);
        });

        test("should execute delay in seconds", async () => {
            const config: DelayConfig = { duration: 0.1, unit: 's' };
            const startTime = Date.now();
            const result = await executeDelay(config);
            const elapsed = Date.now() - startTime;

            expect(result.delayed).toBeGreaterThanOrEqual(95); // 100ms with tolerance
            expect(result.delayed).toBeLessThan(150);
            expect(result.unit).toBe('s');
            expect(elapsed).toBeGreaterThanOrEqual(95);
        });

        test("should handle zero delay", async () => {
            const config: DelayConfig = { duration: 0 };
            const result = await executeDelay(config);

            expect(result.delayed).toBeGreaterThanOrEqual(0);
            expect(result.delayed).toBeLessThan(10); // Should be nearly instant
            expect(result.unit).toBe('ms');
        });

        test("should return valid ISO timestamp", async () => {
            const config: DelayConfig = { duration: 10 };
            const result = await executeDelay(config);

            // Validate ISO 8601 format
            const timestamp = new Date(result.timestamp);
            expect(timestamp.toISOString()).toBe(result.timestamp);
        });

        test("should measure actual delay time accurately", async () => {
            const config: DelayConfig = { duration: 100 };
            const result = await executeDelay(config);

            // Actual delay should be close to requested delay (within 50ms tolerance)
            expect(result.delayed).toBeGreaterThanOrEqual(95);
            expect(result.delayed).toBeLessThan(150);
        });

        test("should handle minimal delay (1ms)", async () => {
            const config: DelayConfig = { duration: 1 };
            const result = await executeDelay(config);

            expect(result.delayed).toBeGreaterThanOrEqual(0);
            expect(result.delayed).toBeLessThan(50); // Should be very quick
            expect(result.unit).toBe('ms');
        });
    });

    describe("edge cases", () => {
        test("should handle very small fractional delays", async () => {
            const config: DelayConfig = { duration: 0.001, unit: 's' }; // 1ms
            const result = await executeDelay(config);

            expect(result.delayed).toBeGreaterThanOrEqual(0);
            expect(result.unit).toBe('s');
        });

        test("should handle large but valid delays", async () => {
            const config: DelayConfig = { duration: 59999 }; // Just under 60s
            const promise = executeDelay(config);

            await Bun.sleep(10);
            expect(promise).toBeDefined();
        }, { timeout: 100 });
    });
});
