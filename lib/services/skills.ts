import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { normalizeSkill, normalizeSkills } from "../matching/skills-normalize";
import type { SkillInput } from "../validation/profile";

/** Autocomplete for the skills input: canonical names containing the query, shortest first. */
export async function searchSkills(query: string, limit = 10): Promise<string[]> {
  const q = normalizeSkill(query);
  if (!q) return [];
  const rows = await db.skill.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 50, select: { name: true } });
  return rows
    .map((row) => row.name)
    .sort((a, b) => Number(!a.startsWith(q)) - Number(!b.startsWith(q)) || a.length - b.length || a.localeCompare(b))
    .slice(0, limit);
}

/**
 * Replaces a user's skills with the given list inside an existing transaction.
 * Names are normalised and de-duplicated; unknown skills are added to the shared vocabulary.
 */
export async function replaceUserSkills(
  tx: Prisma.TransactionClient,
  userId: string,
  skills: readonly SkillInput[],
  source: "MANUAL" | "RESUME" = "MANUAL",
): Promise<void> {
  const byName = new Map<string, SkillInput>();
  for (const skill of skills) {
    const [name] = normalizeSkills([skill.name]);
    if (name && !byName.has(name)) byName.set(name, skill);
  }

  await tx.userSkill.deleteMany({ where: { userId } });
  for (const [name, skill] of byName) {
    const row = await tx.skill.upsert({ where: { name }, create: { name }, update: {} });
    await tx.userSkill.create({
      data: { userId, skillId: row.id, level: skill.level, years: skill.years ?? null, source },
    });
  }
}
