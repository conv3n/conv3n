// pkg/blocks/custom/code.ts
// Custom Code Block: Execute user-provided TypeScript/JavaScript
// This block allows users to write arbitrary code that will be executed in the Bun runtime.

import { stdin, stdout } from "bun";

// Define type-safe input/output interfaces
interface CustomCodeInput {
    config: {
        code: string; // User-provided code as a string
    };
    input?: any; // Optional input data from previous blocks
}

interface CustomCodeOutput {
    success: boolean;
    data?: any;
    error?: {
        message: string;
        stack?: string;
        type: string;
    };
    executionTime: number;
}

async function main() {
    const startTime = performance.now();

    try {
        // 1. Read and validate input
        const input: CustomCodeInput = await Bun.stdin.json();

        if (!input.config || !input.config.code) {
            throw new Error("Missing required config: code");
        }

        const userCode = input.config.code;

        // Determine the data to pass to user function
        // If config.input is specified (resolved from variables), use it
        // Otherwise, use the input field from the payload
        const userData = (input.config as any).input !== undefined
            ? (input.config as any).input
            : (input.input || {});

        // 2. Validate syntax by attempting to transpile
        // Bun's transpiler will throw if there are syntax errors
        try {
            const transpiler = new Bun.Transpiler({
                loader: "ts",
            });
            transpiler.transformSync(userCode);
        } catch (syntaxError: any) {
            // Syntax validation failed - return detailed error
            const endTime = performance.now();
            const result: CustomCodeOutput = {
                success: false,
                error: {
                    message: `Syntax Error: ${syntaxError.message}`,
                    stack: syntaxError.stack,
                    type: "SyntaxError",
                },
                executionTime: endTime - startTime,
            };
            await Bun.write(Bun.stdout, JSON.stringify(result));
            return;
        }

        // 3. Execute user code in isolated context
        // User code should export a default async function that accepts input and returns output
        // Example: export default async (input) => { return { result: input.value * 2 }; }

        let userFunction: (input: any) => Promise<any>;

        try {
            // Create a temporary module from the user code
            // We wrap it to ensure it's a valid module
            const moduleCode = userCode.includes("export default")
                ? userCode
                : `export default async (input) => { ${userCode} }`;

            // Use dynamic import with data URL to execute the code
            // This provides better isolation than eval()
            const dataUrl = `data:text/typescript;base64,${btoa(moduleCode)}`;
            const module = await import(dataUrl);
            userFunction = module.default;

            if (typeof userFunction !== "function") {
                throw new Error("User code must export a default function");
            }
        } catch (importError: any) {
            // Failed to create executable function
            const endTime = performance.now();
            const result: CustomCodeOutput = {
                success: false,
                error: {
                    message: `Import Error: ${importError.message}`,
                    stack: importError.stack,
                    type: "ImportError",
                },
                executionTime: endTime - startTime,
            };
            await Bun.write(Bun.stdout, JSON.stringify(result));
            return;
        }

        // 4. Execute the user function with input data
        let executionResult: any;

        try {
            executionResult = await userFunction(userData);
        } catch (runtimeError: any) {
            // Runtime error during execution
            const endTime = performance.now();
            const result: CustomCodeOutput = {
                success: false,
                error: {
                    message: `Runtime Error: ${runtimeError.message}`,
                    stack: runtimeError.stack,
                    type: runtimeError.name || "RuntimeError",
                },
                executionTime: endTime - startTime,
            };
            await Bun.write(Bun.stdout, JSON.stringify(result));
            return;
        }

        // 5. Return successful result
        const endTime = performance.now();
        const result: CustomCodeOutput = {
            success: true,
            data: executionResult,
            executionTime: endTime - startTime,
        };

        await Bun.write(Bun.stdout, JSON.stringify(result));

    } catch (error: any) {
        // Catch-all for unexpected errors
        console.error(`Custom Code Block Failed: ${error}`);
        const endTime = performance.now();
        const result: CustomCodeOutput = {
            success: false,
            error: {
                message: error.message || "Unknown error",
                stack: error.stack,
                type: "UnexpectedError",
            },
            executionTime: endTime - startTime,
        };
        await Bun.write(Bun.stdout, JSON.stringify(result));
        process.exit(1);
    }
}

main();
