// pkg/blocks/std/http_request.ts
// Standard Block: HTTP Request
// This script is executed by the Bun Runner. It expects a JSON payload with 'config'.

import { stdin, stdout } from "bun";

// Type definitions for better type safety
export interface HttpRequestConfig {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
}

export interface HttpRequestInput {
    config: HttpRequestConfig;
}

export interface HttpRequestOutput {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
}

// Validate configuration
export function validateConfig(config: any): void {
    if (!config || !config.url) {
        throw new Error("Missing required config: url");
    }
}

// Execute HTTP request
export async function executeHttpRequest(config: HttpRequestConfig): Promise<HttpRequestOutput> {
    const method = config.method || "GET";
    const headers = config.headers || {};
    const body = config.body ? JSON.stringify(config.body) : undefined;

    const response = await fetch(config.url, {
        method,
        headers,
        body,
    });

    // Process response
    const responseData = await response.text();
    let parsedData;
    try {
        parsedData = JSON.parse(responseData);
    } catch {
        parsedData = responseData; // Fallback to text if not JSON
    }

    return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: parsedData,
    };
}

// Main execution function
export async function main() {
    try {
        // 1. Read Input (Config + Context)
        const input: HttpRequestInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute request
        const result = await executeHttpRequest(config);

        // 4. Write Output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error) {
        // Write error to stderr
        console.error(`HTTP Request Failed: ${error}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
