// Shared by the test setup, Playwright and its prepare script: where the test databases live.
// Tests and the browser test run in their own PostgreSQL *schemas* of the same database
// (named "test" and "e2e"), so they never touch the data in the normal "public" schema.
import fs from "node:fs";
import path from "node:path";

/** DATABASE_URL from the environment or the project's .env file. */
export function baseDatabaseUrl() {
  if (process.env.DATABASE_URL?.startsWith("postgres")) return process.env.DATABASE_URL;
  const file = path.join(process.cwd(), ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
      if (match && match[1].startsWith("postgres")) return match[1];
    }
  }
  throw new Error("DATABASE_URL must be a PostgreSQL connection string (for example your Neon URL) in .env or the environment.");
}

/** The same database, pointed at a named schema. */
export function schemaUrl(schema) {
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("schema", schema);
  return url.toString();
}

/** Drops and recreates one named schema. Refuses anything but the throwaway test schemas. */
export async function resetSchema(schema) {
  if (!["test", "e2e"].includes(schema)) throw new Error(`Refusing to reset schema "${schema}".`);
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({ datasourceUrl: schemaUrl(schema) });
  try {
    await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  } finally {
    await client.$disconnect();
  }
}
