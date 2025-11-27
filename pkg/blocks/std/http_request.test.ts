// pkg/blocks/std/http_request.test.ts
// Unit tests for HTTP Request block

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
    validateConfig,
    executeHttpRequest,
    type HttpRequestConfig,
} from "./http_request";

describe("HTTP Request Block", () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe("validateConfig", () => {
        test("should pass for valid config with url", () => {
            const config = { url: "https://example.com" };
            expect(() => validateConfig(config)).not.toThrow();
        });

        test("should throw error when url is missing", () => {
            const config = { method: "GET" };
            expect(() => validateConfig(config)).toThrow("Missing required config: url");
        });

        test("should throw error when config is null", () => {
            expect(() => validateConfig(null)).toThrow("Missing required config");
        });

        test("should throw error when config is undefined", () => {
            expect(() => validateConfig(undefined)).toThrow("Missing required config");
        });
    });

    describe("executeHttpRequest", () => {
        test("should make successful GET request", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({ "Content-Type": "application/json" }),
                text: async () => JSON.stringify({ message: "success" }),
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/data",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(200);
            expect(result.statusText).toBe("OK");
            expect(result.data).toEqual({ message: "success" });
            expect(result.headers["content-type"]).toBe("application/json");
        });

        test("should make successful POST request with body", async () => {
            const mockResponse = {
                status: 201,
                statusText: "Created",
                headers: new Headers({ "Content-Type": "application/json" }),
                text: async () => JSON.stringify({ id: 123 }),
            };

            global.fetch = mock(async (url: string, options?: any) => {
                // Verify request body
                expect(options.body).toBe(JSON.stringify({ name: "John Doe", email: "john@example.com" }));
                return mockResponse as any;
            }) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/users",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: {
                    name: "John Doe",
                    email: "john@example.com",
                },
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(201);
            expect(result.statusText).toBe("Created");
            expect(result.data).toEqual({ id: 123 });
        });

        test("should handle text responses", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({ "Content-Type": "text/plain" }),
                text: async () => "Plain text response",
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/text",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(200);
            expect(result.data).toBe("Plain text response");
        });

        test("should handle custom headers", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({ "Content-Type": "application/json" }),
                text: async () => JSON.stringify({ ok: true }),
            };

            global.fetch = mock(async (url: string, options?: any) => {
                // Verify custom headers
                expect(options.headers["Authorization"]).toBe("Bearer token123");
                expect(options.headers["X-Custom-Header"]).toBe("custom-value");
                return mockResponse as any;
            }) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/secure",
                method: "GET",
                headers: {
                    "Authorization": "Bearer token123",
                    "X-Custom-Header": "custom-value",
                },
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ ok: true });
        });

        test("should default to GET method when not specified", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers(),
                text: async () => JSON.stringify({ ok: true }),
            };

            global.fetch = mock(async (url: string, options?: any) => {
                // Verify default method
                expect(options.method).toBe("GET");
                return mockResponse as any;
            }) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/default",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(200);
        });

        test("should include response headers in output", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({
                    "Content-Type": "application/json",
                    "X-Response-Time": "123ms",
                }),
                text: async () => JSON.stringify({ ok: true }),
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/headers",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            expect(result.headers).toBeDefined();
            expect(result.headers["content-type"]).toBe("application/json");
            expect(result.headers["x-response-time"]).toBe("123ms");
        });

        test("should handle network errors", async () => {
            global.fetch = mock(async () => {
                throw new Error("Network error: Connection refused");
            }) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/fail",
                method: "GET",
            };

            await expect(executeHttpRequest(config)).rejects.toThrow("Network error: Connection refused");
        });

        test("should handle different HTTP methods", async () => {
            const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

            for (const method of methods) {
                const mockResponse = {
                    status: 200,
                    statusText: "OK",
                    headers: new Headers(),
                    text: async () => JSON.stringify({ method }),
                };

                global.fetch = mock(async (url: string, options?: any) => {
                    expect(options.method).toBe(method);
                    return mockResponse as any;
                }) as any;

                const config: HttpRequestConfig = {
                    url: "https://api.example.com/test",
                    method,
                };

                const result = await executeHttpRequest(config);
                expect(result.data).toEqual({ method });
            }
        });

        test("should handle empty response body", async () => {
            const mockResponse = {
                status: 204,
                statusText: "No Content",
                headers: new Headers(),
                text: async () => "",
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/empty",
                method: "DELETE",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(204);
            expect(result.data).toBe("");
        });

        test("should handle malformed JSON gracefully", async () => {
            const mockResponse = {
                status: 200,
                statusText: "OK",
                headers: new Headers({ "Content-Type": "application/json" }),
                text: async () => "{invalid json}",
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/malformed",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            // Should fallback to text
            expect(result.data).toBe("{invalid json}");
        });

        test("should handle 404 error", async () => {
            const mockResponse = {
                status: 404,
                statusText: "Not Found",
                headers: new Headers(),
                text: async () => JSON.stringify({ error: "Not found" }),
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/notfound",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(404);
            expect(result.statusText).toBe("Not Found");
            expect(result.data).toEqual({ error: "Not found" });
        });

        test("should handle 500 server error", async () => {
            const mockResponse = {
                status: 500,
                statusText: "Internal Server Error",
                headers: new Headers(),
                text: async () => "Server error",
            };

            global.fetch = mock(async () => mockResponse as any) as any;

            const config: HttpRequestConfig = {
                url: "https://api.example.com/error",
                method: "GET",
            };

            const result = await executeHttpRequest(config);

            expect(result.status).toBe(500);
            expect(result.statusText).toBe("Internal Server Error");
        });
    });

    describe("getOutputPort", () => {
        const { getOutputPort } = require("./http_request");

        test("should return success for 2xx status", () => {
            expect(getOutputPort(200)).toBe("success");
            expect(getOutputPort(201)).toBe("success");
            expect(getOutputPort(299)).toBe("success");
        });

        test("should return client_error for 4xx status", () => {
            expect(getOutputPort(400)).toBe("client_error");
            expect(getOutputPort(404)).toBe("client_error");
            expect(getOutputPort(499)).toBe("client_error");
        });

        test("should return server_error for 5xx status", () => {
            expect(getOutputPort(500)).toBe("server_error");
            expect(getOutputPort(503)).toBe("server_error");
        });

        test("should return default for other status", () => {
            expect(getOutputPort(100)).toBe("default");
            expect(getOutputPort(300)).toBe("default");
        });
    });
});
