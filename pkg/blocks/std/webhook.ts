// pkg/blocks/std/webhook.ts
// Standard Block: Webhook Operations
// Provides outgoing HTTP requests for external API integration

import { stdin, stdout } from "bun";

// Maximum timeout to prevent hanging requests
const MAX_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_TIMEOUT_MS = 30000;

// Type definitions for webhook operations
export interface WebhookConfig {
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;                         // JSON object or string
    timeout?: number;                   // Timeout in milliseconds
}

export interface WebhookInput {
    config: WebhookConfig;
    input?: any;                        // Data from previous blocks
}

export interface WebhookOutput {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    duration: number;                   // Request duration in milliseconds
}

// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (!config.url || typeof config.url !== 'string') {
        throw new Error("Config 'url' must be a non-empty string");
    }

    // Validate URL format
    try {
        new URL(config.url);
    } catch (error) {
        throw new Error(`Invalid URL format: ${config.url}`);
    }

    if (!config.method) {
        throw new Error("Missing required config: method");
    }

    const validMethods = ['POST', 'PUT', 'PATCH'];
    if (!validMethods.includes(config.method)) {
        throw new Error(`Invalid HTTP method: ${config.method}. Must be one of: ${validMethods.join(', ')}`);
    }

    if (config.headers !== undefined && typeof config.headers !== 'object') {
        throw new Error("Config 'headers' must be an object");
    }

    if (config.timeout !== undefined) {
        if (typeof config.timeout !== 'number' || config.timeout <= 0) {
            throw new Error("Config 'timeout' must be a positive number");
        }
        if (config.timeout > MAX_TIMEOUT_MS) {
            throw new Error(`Timeout (${config.timeout}ms) exceeds maximum allowed (${MAX_TIMEOUT_MS}ms)`);
        }
    }
}

// Execute webhook request with timeout
export async function executeWebhook(config: WebhookConfig): Promise<WebhookOutput> {
    const timeout = config.timeout || DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    try {
        // Prepare request body
        let requestBody: string | undefined;
        let headers = config.headers || {};

        if (config.body !== undefined) {
            if (typeof config.body === 'object') {
                requestBody = JSON.stringify(config.body);
                // Set Content-Type if not already set
                if (!headers['Content-Type'] && !headers['content-type']) {
                    headers['Content-Type'] = 'application/json';
                }
            } else {
                requestBody = String(config.body);
            }
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Execute HTTP request
            const response = await fetch(config.url, {
                method: config.method,
                headers,
                body: requestBody,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const duration = Date.now() - startTime;

            // Parse response body
            const responseText = await response.text();
            let parsedData: any;
            try {
                parsedData = JSON.parse(responseText);
            } catch {
                parsedData = responseText; // Fallback to text if not JSON
            }

            // Check for HTTP errors
            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status} ${response.statusText}: ${typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData)}`
                );
            }

            return {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: parsedData,
                duration,
            };

        } catch (error: any) {
            clearTimeout(timeoutId);

            // Handle timeout errors
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }

            // Handle network errors
            if (error.message.includes('fetch failed')) {
                throw new Error(`Network error: ${error.message}`);
            }

            // Re-throw other errors
            throw error;
        }

    } catch (error: any) {
        throw new Error(`Webhook request failed: ${error.message}`);
    }
}

// Main execution function
export async function main() {
    try {
        // 1. Read input
        const input: WebhookInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute webhook request
        const result = await executeWebhook(config);

        // 4. Write output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error: any) {
        console.error(`Webhook Block Failed: ${error.message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
