// pkg/blocks/std/delay.ts
// Standard Block: Delay/Sleep
// Introduces time delays in workflow execution.

// Type definitions for input/output
export interface DelayConfig {
    duration: number;        // Duration of delay
    unit?: "ms" | "s";       // Time unit (default: 'ms')
}

export interface DelayInput {
    config: DelayConfig;
    input?: unknown;         // Data from previous blocks (passed through)
}

export interface DelayOutput {
    delayed: number;         // Actual delay in milliseconds
    timestamp: string;       // ISO timestamp when delay completed
    unit: string;            // Unit used for delay
}

export interface BlockResult {
    data: DelayOutput;
    port: string;
}

// Validate configuration
export function validateConfig(config: unknown): asserts config is DelayConfig {
    if (!config || typeof config !== "object") {
        throw new Error("Missing required config");
    }

    if (!("duration" in config) || typeof config.duration !== "number") {
        throw new Error("Config 'duration' must be a number");
    }

    if (config.duration < 0) {
        throw new Error("Config 'duration' must be non-negative");
    }

    if ("unit" in config && config.unit !== undefined && config.unit !== "ms" && config.unit !== "s") {
        throw new Error("Config 'unit' must be 'ms' or 's'");
    }
}

// Convert duration to milliseconds based on unit
export function convertToMilliseconds(duration: number, unit: "ms" | "s" = "ms"): number {
    return unit === "s" ? duration * 1000 : duration;
}

// Execute delay
export async function executeDelay(config: DelayConfig): Promise<DelayOutput> {
    const unit = config.unit ?? "ms";
    const durationMs = convertToMilliseconds(config.duration, unit);

    // Perform the actual delay using Bun's native sleep
    const startTime = Date.now();
    await Bun.sleep(durationMs);
    const actualDelay = Date.now() - startTime;

    return {
        delayed: actualDelay,
        timestamp: new Date().toISOString(),
        unit,
    };
}

// Main execution function
export async function main(): Promise<void> {
    try {
        // 1. Read input
        const input: DelayInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute delay
        const result = await executeDelay(config);

        // 4. Build output with port routing
        const output: BlockResult = {
            data: result,
            port: "default",
        };

        // 5. Write output
        await Bun.write(Bun.stdout, JSON.stringify(output));

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Delay Block Failed: ${message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
