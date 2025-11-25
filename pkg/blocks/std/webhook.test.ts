// pkg/blocks/std/webhook.test.ts
// Unit tests for Webhook block

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
    validateConfig,
    executeWebhook,
    type WebhookConfig,
} from "./webhook";
import type { Server } from "bun";

// Mock HTTP server for testing
let mockServer: Server<any>;
let mockServerUrl: string;

describe("Webhook Block", () => {
    // Setup mock HTTP server
    beforeAll(() => {
        mockServer = Bun.serve({
            port: 0, // Random available port
            fetch(req) {
                const url = new URL(req.url);

                // Route: /success - returns 200 OK
                if (url.pathname === '/success') {
                    return new Response(JSON.stringify({ message: "Success" }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Route: /created - returns 201 Created
                if (url.pathname === '/created') {
                    return new Response(JSON.stringify({ id: 123 }), {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Route: /no-content - returns 204 No Content
                if (url.pathname === '/no-content') {
                    return new Response(null, { status: 204 });
                }

                // Route: /echo - echoes back the request body
                if (url.pathname === '/echo') {
                    return req.text().then(body => {
                        return new Response(body, {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                }

                // Route: /bad-request - returns 400 Bad Request
                if (url.pathname === '/bad-request') {
                    return new Response(JSON.stringify({ error: "Bad Request" }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Route: /not-found - returns 404 Not Found
                if (url.pathname === '/not-found') {
                    return new Response(JSON.stringify({ error: "Not Found" }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Route: /server-error - returns 500 Internal Server Error
                if (url.pathname === '/server-error') {
                    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Route: /delay - delays response
                if (url.pathname === '/delay') {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(new Response(JSON.stringify({ delayed: true }), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            }));
                        }, 100);
                    });
                }

                // Route: /text - returns plain text
                if (url.pathname === '/text') {
                    return new Response("Plain text response", {
                        status: 200,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                }

                // Default: 404
                return new Response("Not Found", { status: 404 });
            }
        });

        mockServerUrl = `http://localhost:${mockServer.port}`;
    });

    // Cleanup mock server
    afterAll(() => {
        if (mockServer) {
            mockServer.stop();
        }
    });

    describe("validateConfig", () => {
        test("should pass for valid POST config", () => {
            const config = {
                url: "https://example.com/webhook",
                method: 'POST' as const
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid PUT config", () => {
            const config = {
                url: "https://example.com/webhook",
                method: 'PUT' as const
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should pass for valid PATCH config", () => {
            const config = {
                url: "https://example.com/webhook",
                method: 'PATCH' as const
            };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when config is missing", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when url is missing", () => {
            const config = {
                method: 'POST' as const
            };
            expect(() => validateConfig(config)).toThrow("Config 'url' must be a non-empty string");
        });

        test("should throw error for invalid URL format", () => {
            const config = {
                url: "not-a-valid-url",
                method: 'POST' as const
            };
            expect(() => validateConfig(config)).toThrow("Invalid URL format");
        });

        test("should throw error when method is missing", () => {
            const config = {
                url: "https://example.com"
            };
            expect(() => validateConfig(config)).toThrow("Missing required config: method");
        });

        test("should throw error for invalid HTTP method", () => {
            const config = {
                url: "https://example.com",
                method: 'GET'
            };
            expect(() => validateConfig(config)).toThrow("Invalid HTTP method: GET");
        });

        test("should throw error when headers is not an object", () => {
            const config = {
                url: "https://example.com",
                method: 'POST' as const,
                headers: "invalid"
            };
            expect(() => validateConfig(config)).toThrow("Config 'headers' must be an object");
        });

        test("should throw error for negative timeout", () => {
            const config = {
                url: "https://example.com",
                method: 'POST' as const,
                timeout: -100
            };
            expect(() => validateConfig(config)).toThrow("Config 'timeout' must be a positive number");
        });

        test("should throw error for timeout exceeding maximum", () => {
            const config = {
                url: "https://example.com",
                method: 'POST' as const,
                timeout: 31000
            };
            expect(() => validateConfig(config)).toThrow("exceeds maximum allowed");
        });
    });

    describe("POST requests", () => {
        test("should execute POST with JSON body", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'POST',
                body: { message: "Hello", count: 42 }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ message: "Hello", count: 42 });
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });

        test("should execute POST with string body", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'POST',
                body: "Plain string"
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toBe("Plain string");
        });

        test("should execute POST with custom headers", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'POST',
                headers: {
                    'X-Custom-Header': 'CustomValue',
                    'Authorization': 'Bearer token123'
                }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ message: "Success" });
        });

        test("should execute POST with empty body", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
        });

        test("should receive 200 OK response", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.statusText).toBe("OK");
        });

        test("should receive 201 Created response", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/created`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(201);
            expect(result.data).toEqual({ id: 123 });
        });
    });

    describe("PUT/PATCH requests", () => {
        test("should execute PUT request with JSON", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'PUT',
                body: { updated: true }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ updated: true });
        });

        test("should execute PATCH request with JSON", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'PATCH',
                body: { field: "value" }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ field: "value" });
        });

        test("should execute PUT with custom headers", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'PUT',
                headers: { 'X-Request-ID': '12345' }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
        });

        test("should receive 204 No Content response", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/no-content`,
                method: 'PUT'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(204);
            expect(result.data).toBe("");
        });
    });

    describe("error handling", () => {
        test("should throw error for HTTP 400 Bad Request", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/bad-request`,
                method: 'POST'
            };

            await expect(executeWebhook(config)).rejects.toThrow("HTTP 400");
        });

        test("should throw error for HTTP 404 Not Found", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/not-found`,
                method: 'POST'
            };

            await expect(executeWebhook(config)).rejects.toThrow("HTTP 404");
        });

        test("should throw error for HTTP 500 Internal Server Error", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/server-error`,
                method: 'POST'
            };

            await expect(executeWebhook(config)).rejects.toThrow("HTTP 500");
        });

        test("should throw error for invalid URL", async () => {
            const config: WebhookConfig = {
                url: "http://invalid-domain-that-does-not-exist-12345.com",
                method: 'POST',
                timeout: 1000
            };

            await expect(executeWebhook(config)).rejects.toThrow("Webhook request failed");
        });

        test("should throw error for connection refused", async () => {
            const config: WebhookConfig = {
                url: "http://localhost:9999", // Port that's not listening
                method: 'POST',
                timeout: 1000
            };

            await expect(executeWebhook(config)).rejects.toThrow("Webhook request failed");
        });
    });

    describe("timeout handling", () => {
        test("should complete request within timeout", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/delay`,
                method: 'POST',
                timeout: 5000
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ delayed: true });
            expect(result.duration).toBeLessThan(5000);
        });

        test("should use default timeout when not specified", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
        });
    });

    describe("edge cases", () => {
        test("should handle large JSON payload", async () => {
            const largePayload = {
                items: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    data: "x".repeat(100)
                }))
            };

            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'POST',
                body: largePayload
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual(largePayload);
        });

        test("should handle special characters in headers", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/success`,
                method: 'POST',
                headers: {
                    'X-Custom': 'value-with-dashes',
                    'X-Numbers': '12345'
                }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
        });

        test("should handle plain text response", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/text`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
            expect(result.data).toBe("Plain text response");
        });

        test("should auto-set Content-Type for JSON body", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/echo`,
                method: 'POST',
                body: { test: true }
            };

            const result = await executeWebhook(config);

            expect(result.status).toBe(200);
        });

        test("should measure request duration accurately", async () => {
            const config: WebhookConfig = {
                url: `${mockServerUrl}/delay`,
                method: 'POST'
            };

            const result = await executeWebhook(config);

            expect(result.duration).toBeGreaterThanOrEqual(90); // ~100ms delay with tolerance
            expect(result.duration).toBeLessThan(200);
        });
    });
});
