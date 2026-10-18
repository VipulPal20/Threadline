export function baseDatabaseUrl(): string;
export function schemaUrl(schema: string): string;
export function resetSchema(schema: "test" | "e2e"): Promise<void>;
