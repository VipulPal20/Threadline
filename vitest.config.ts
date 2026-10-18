import path from "node:path";
import { defineConfig } from "vitest/config";
import { schemaUrl } from "./tests/db-env.mjs";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Service tests share one database schema, so run test files one at a time.
    fileParallelism: false,
    env: {
      DATABASE_URL: schemaUrl("test"),
      SESSION_SECRET: "test-secret",
      APP_URL: "http://localhost:3000",
      RESUME_DIR: "./.test-resumes",
    },
    passWithNoTests: true,
  },
});
