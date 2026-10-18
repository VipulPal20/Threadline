// Runs before the test server starts: begin every e2e run with an empty "e2e" database schema and no uploaded résumés.
import fs from "node:fs";
import path from "node:path";
import { resetSchema } from "../db-env.mjs";

await resetSchema("e2e");
fs.rmSync(path.join(process.cwd(), ".e2e-resumes"), { recursive: true, force: true });
