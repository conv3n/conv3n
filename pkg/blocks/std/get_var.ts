/**
 * GetVar block - Retrieves a user-defined variable from the execution context.
 * Variables are accessed via {{ $vars.name }} syntax in config.
 */

export default async function getVar(input: any): Promise<any> {
    const { name } = input.config;

    if (!name || typeof name !== "string") {
        throw new Error("Variable name is required and must be a string");
    }

    // The value is resolved by the variable resolver before this block executes
    // We just pass through the resolved value
    const value = input.config.value;

    return {
        data: {
            action: "get_var",
            name,
            value,
        },
        port: "default",
    };
}
