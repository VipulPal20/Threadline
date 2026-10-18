import vocabulary from "../../data/vocab/skills-by-category.json";
import { normalizeSkills } from "../matching/skills-normalize";
import type { ResumeDraft } from "./schemas";

const KNOWN_SKILLS = Array.from(
  new Set(Object.values(vocabulary as Record<string, Record<string, number>>).flatMap((skills) => Object.keys(skills))),
);

const TITLE_WORDS = /\b(engineer|developer|analyst|manager|intern|founder|researcher|designer|consultant|scientist|architect|lead|associate)\b/i;
const DEGREE_WORDS = /\b(b\.?\s?tech|b\.?\s?e\.?|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|bachelor|master|mba|ph\.?d|diploma)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Conservative résumé reading used when Gemini is off, over its cap, or returns bad output.
 * It only reports what it can see: known skill names, lines that look like job titles or degrees.
 */
export function resumeFallback(text: string): ResumeDraft {
  const lines = text.split(/\r?\n|\s{3,}/).map((line) => line.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  const skills = normalizeSkills(
    KNOWN_SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(skill)}($|[^a-z0-9])`).test(lower)),
  ).slice(0, 30);

  const roles = lines
    .filter((line) => line.length <= 120 && TITLE_WORDS.test(line))
    .slice(0, 6)
    .map((title) => ({
      type: /intern/i.test(title) ? ("INTERNSHIP" as const) : ("JOB" as const),
      title,
      organisation: null,
      start: null,
      end: null,
      isCurrent: false,
      description: null,
    }));

  const education = lines
    .filter((line) => line.length <= 160 && DEGREE_WORDS.test(line))
    .slice(0, 3)
    .map((line) => {
      const years = (line.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
      return {
        institution: line,
        degree: line.match(DEGREE_WORDS)?.[0] ?? null,
        field: null,
        startYear: years.length > 1 ? Math.min(...years) : null,
        endYear: years.length ? Math.max(...years) : null,
      };
    });

  return { headline: null, roles, education, skills };
}
