// pkg/blocks/std/delay.ts
// Standard Block: Delay/Sleep
// Introduces time delays in workflow execution

import { stdin, stdout } from "bun";

// Type definitions for input/output
export interface DelayConfig {
    duration: number;        // Duration of delay
    unit?: 'ms' | 's';      // Time unit (default: 'ms')
}

export interface DelayInput {
    config: DelayConfig;
    input?: any;             // Data from previous blocks (passed through)
}

export interface DelayOutput {
    delayed: number;         // Actual delay in milliseconds
    timestamp: string;       // ISO timestamp when delay completed
    unit: string;           // Unit used for delay
}



// Validate configuration
export function validateConfig(config: any): void {
    if (!config) {
        throw new Error("Missing required config");
    }

    if (typeof config.duration !== 'number') {
        throw new Error("Config 'duration' must be a number");
    }

    if (config.duration < 0) {
        throw new Error("Config 'duration' must be non-negative");
    }

    if (config.unit !== undefined && config.unit !== 'ms' && config.unit !== 's') {
        throw new Error("Config 'unit' must be 'ms' or 's'");
    }
}

// Convert duration to milliseconds based on unit
export function convertToMilliseconds(duration: number, unit: 'ms' | 's' = 'ms'): number {
    return unit === 's' ? duration * 1000 : duration;
}

// Execute delay with DoS protection
export async function executeDelay(config: DelayConfig): Promise<DelayOutput> {
    const unit = config.unit || 'ms';
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
export async function main() {
    try {
        // 1. Read input
        const input: DelayInput = await Bun.stdin.json();
        const { config } = input;

        // 2. Validate config
        validateConfig(config);

        // 3. Execute delay
        const result = await executeDelay(config);

        // 4. Write output
        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error: any) {
        // Write error to stderr
        console.error(`Delay Block Failed: ${error.message}`);
        process.exit(1);
    }
}

// Only run main if this is the entry point
if (import.meta.main) {
    main();
}
