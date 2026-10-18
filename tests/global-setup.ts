import { execSync } from "node:child_process";
import { resetSchema, schemaUrl } from "./db-env.mjs";

/** Builds a fresh "test" schema from the real migrations before any test file runs. */
export default async function setup() {
  await resetSchema("test");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: schemaUrl("test") } });
}
