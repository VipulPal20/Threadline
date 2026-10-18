import { createHmac, randomBytes } from "node:crypto";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production.");
  return "dev-only-insecure-secret";
}

/** Random URL-safe token. Only its hash is ever stored. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}
