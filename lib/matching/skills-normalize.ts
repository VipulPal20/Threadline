import synonyms from "./synonyms.json";

const SYNONYMS = synonyms as Record<string, string>;

/** Canonical skill name: lowercase, trimmed, single-spaced, with common aliases folded together. */
export function normalizeSkill(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  return SYNONYMS[cleaned] ?? cleaned;
}

/** Normalises, drops blanks and removes duplicates while keeping first-seen order. */
export function normalizeSkills(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const name = normalizeSkill(item);
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
