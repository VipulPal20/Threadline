import { db } from "../db";
import { isGeminiConfigured } from "./gemini";

export const DAILY_AI_LIMIT = 50;

/** Midnight UTC today; the daily cap resets then. */
function startOfDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * True when this user may make another Gemini call: a key is set, the institute has AI on,
 * and the per-user daily cap is not used up. Counts the call (no content stored).
 */
export async function reserveAiCall(user: { id: string; instituteId: string }, task: string): Promise<boolean> {
  if (!isGeminiConfigured()) return false;
  const institute = await db.institute.findUnique({ where: { id: user.instituteId }, select: { aiEnabled: true } });
  if (!institute?.aiEnabled) return false;

  const used = await db.auditEvent.count({
    where: { actorId: user.id, kind: "ai.call", createdAt: { gte: startOfDay() } },
  });
  if (used >= DAILY_AI_LIMIT) return false;

  await db.auditEvent.create({
    data: { instituteId: user.instituteId, actorId: user.id, kind: "ai.call", payload: JSON.stringify({ task }) },
  });
  return true;
}
