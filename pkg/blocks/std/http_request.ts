// pkg/blocks/std/http_request.ts
// Standard Block: HTTP Request
// Executes HTTP requests and returns response with routing port.

// Type definitions for better type safety
export interface HttpRequestConfig {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface HttpRequestInput {
    config: HttpRequestConfig;
}

export interface HttpRequestOutput {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
}

export interface BlockResult {
    data: HttpRequestOutput;
    port: string;
}

// Validate configuration
export function validateConfig(config: unknown): asserts config is HttpRequestConfig {
    if (!config || typeof config !== "object") {
        throw new Error("Missing required config");
    }
    if (!("url" in config) || typeof config.url !== "string") {
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

    let parsedData: unknown;
    try {
        parsedData = JSON.parse(responseData);
    } catch {
        // Fallback to raw text if not valid JSON
        parsedData = responseData;
    }

    return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: parsedData,
    };
}

// Determine output port based on response status
export function getOutputPort(status: number): string {
    if (status >= 200 && status < 300) {
        return "success";
    } else if (status >= 400 && status < 500) {
        return "client_error";
    } else if (status >= 500) {
        return "server_error";
    }
    return "default";
}

// Main execution function
export async function main(): Promise<void> {
    try {
        // 1. Read Input (Config + Context)
        const input: HttpRequestInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute request
        const result = await executeHttpRequest(config);

        // 4. Build output with port routing
        const output: BlockResult = {
            data: result,
            port: getOutputPort(result.status),
        };

        // 5. Write Output
        await Bun.write(Bun.stdout, JSON.stringify(output));

    } catch (error) {
        // Write error result with error port
        const errorOutput: BlockResult = {
            data: {
                status: 0,
                statusText: "Error",
                headers: {},
                data: { error: error instanceof Error ? error.message : String(error) },
            },
            port: "error",
        };
        await Bun.write(Bun.stdout, JSON.stringify(errorOutput));
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
