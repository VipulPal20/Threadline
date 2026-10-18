import path from "node:path";
import { defineConfig } from "@playwright/test";
import { schemaUrl } from "./tests/db-env.mjs";

/**
 * End-to-end happy path against the real production build.
 *   Locally:  npm run build, then  E2E_CHANNEL=chrome npm run e2e   (uses your installed Chrome, no download)
 *   In CI:    npx playwright install --with-deps chromium, then npm run e2e
 * It starts the built app on its own port with a fresh database made from the committed migrations.
 */
const PORT = Number(process.env.E2E_PORT ?? 3217); // an unusual port, so it never collides with another dev server
const root = process.cwd();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node tests/e2e/prepare.mjs && npx prisma migrate deploy && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: schemaUrl("e2e"),
      SESSION_SECRET: "e2e-secret-not-for-production",
      APP_URL: `http://localhost:${PORT}`,
      RESUME_DIR: path.join(root, ".e2e-resumes"),
      GEMINI_API_KEY: "",
    },
  },
});
