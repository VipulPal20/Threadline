import { tooMany } from "../errors";

/**
 * In-memory failed-attempt limiter. Good enough for one server process;
 * swap for a shared store (Redis) before running multiple instances.
 */
interface Bucket {
  failures: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function current(key: string, now: number): Bucket | undefined {
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt <= now) {
    buckets.delete(key);
    return undefined;
  }
  return bucket;
}

export function assertNotLimited(key: string, max = LOGIN_MAX_FAILURES, now = Date.now()): void {
  const bucket = current(key, now);
  if (bucket && bucket.failures >= max) throw tooMany("Too many failed attempts. Try again in a few minutes.");
}

export function recordFailure(key: string, windowMs = LOGIN_WINDOW_MS, now = Date.now()): void {
  const bucket = current(key, now);
  if (bucket) bucket.failures += 1;
  else buckets.set(key, { failures: 1, resetAt: now + windowMs });
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}

export function resetRateLimits(): void {
  buckets.clear();
}

export const HOUR_MS = 60 * 60 * 1000;

/**
 * Counts every call (not just failures) and refuses once `max` calls happen inside the window.
 * Used for sign-up, uploads and other actions that should never be hammered.
 */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): void {
  const bucket = current(key, now);
  if (!bucket) {
    buckets.set(key, { failures: 1, resetAt: now + windowMs });
    return;
  }
  bucket.failures += 1;
  if (bucket.failures > max) throw tooMany("You're doing that too often. Please wait a while and try again.");
}
