// pkg/blocks/std/http_request.ts
// Standard Block: HTTP Request
// This script is executed by the Bun Runner. It expects a JSON payload with 'config'.

import { stdin, stdout } from "bun";

async function main() {
    try {
        // 1. Read Input (Config + Context)
        const input = await Bun.stdin.json();
        const { config } = input;

        // Validate config
        if (!config || !config.url) {
            throw new Error("Missing required config: url");
        }

        const method = config.method || "GET";
        const headers = config.headers || {};
        const body = config.body ? JSON.stringify(config.body) : undefined;

        // 2. Execute Logic (Fetch)
        const response = await fetch(config.url, {
            method,
            headers,
            body,
        });

        // 3. Process Output
        const responseData = await response.text();
        let parsedData;
        try {
            parsedData = JSON.parse(responseData);
        } catch {
            parsedData = responseData; // Fallback to text if not JSON
        }

        const result = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: parsedData,
        };

        // 4. Write Output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error) {
        // Write error to stderr
        console.error(`HTTP Request Failed: ${error}`);
        process.exit(1);
    }
}

main();
