// runner.ts
// This script acts as the entry point for the Bunock runtime.
// It reads a JSON payload from Stdin, executes the block logic, and writes the result to Stdout.

import { stdin, stdout } from "bun";

async function main() {
    try {
        // Read all data from stdin
        // Bun.stdin.json() is a convenient way to parse the input directly
        const input = await Bun.stdin.json();

        // TODO: Here we will eventually load and execute the specific block logic.
        // For the prototype, we just echo the input with a modification to prove it works.

        const result = {
            status: "success",
            processed_at: new Date().toISOString(),
            original_input: input,
            message: "Hello from Bunock!"
        };

        // Write the result to stdout as a single line JSON
        const output = JSON.stringify(result);
        await Bun.write(Bun.stdout, output);

    } catch (error) {
        // If something goes wrong, we write the error to stderr and exit with non-zero code
        // The Go engine will capture stderr.
        console.error("Bunock Runtime Error:", error);
        process.exit(1);
    }
}

main();
