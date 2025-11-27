/**
 * SetVar block - Sets a user-defined variable in the execution context.
 * Variables persist across nodes and can be accessed via {{ $vars.name }} syntax.
 */

export default async function setVar(input: any): Promise<any> {
    const { name, value } = input.config;

    if (!name || typeof name !== "string") {
        throw new Error("Variable name is required and must be a string");
    }

    // Return special action marker for Go engine to process
    // The actual variable setting happens in the Go orchestrator
    return {
        data: {
            action: "set_var",
            name,
            value,
        },
        port: "default",
    };
}
