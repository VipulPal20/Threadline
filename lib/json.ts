/** JSON helpers for list columns stored as strings (SQLite has no scalar lists). */

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function toList(values: readonly string[] | null | undefined): string {
  return JSON.stringify(Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))));
}
