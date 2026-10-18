import cities from "../../data/lists/cities.json";
import vocabulary from "../../data/vocab/skills-by-category.json";
import { normalizeSkills } from "../matching/skills-normalize";
import type { AskSuggestion } from "../validation/ask";
import { askSuggestionSchema } from "../validation/ask";
import { reserveAiCall } from "./budget";
import { generateJson } from "./gemini";
import { ASK_AUTOFILL_PROMPT } from "./prompts";
import { redactContacts } from "./redact";

const KNOWN_SKILLS = Array.from(new Set(Object.values(vocabulary as Record<string, Record<string, number>>).flatMap((skills) => Object.keys(skills))));
const CATEGORY_RULES: Array<[RegExp, AskSuggestion["category"]]> = [
  [/\b(referral|refer me|refer)\b/i, "referral"],
  [/\b(mock interview|interview practice|practice interview)\b/i, "mock_interview"],
  [/\b(resume|résumé|cv)\b/i, "resume_review"],
  [/\b(mentor|mentorship|guidance)\b/i, "mentorship"],
  [/\b(research|paper|thesis|phd)\b/i, "research"],
  [/\b(funding|investor|fundraise|startup)\b/i, "funding"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Simple keyword reader used when Gemini is off or fails. It only fills fields it can see in the text. */
export function autofillFallback(description: string): AskSuggestion {
  const text = description.trim();
  const category = CATEGORY_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "career_advice";
  const lower = text.toLowerCase();
  const skills = normalizeSkills(KNOWN_SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(skill)}($|[^a-z0-9])`).test(lower))).slice(0, 8);
  const location = (cities as string[]).find((city) => lower.includes(city.toLowerCase())) ?? null;
  const dateText = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const deadline = dateText && !Number.isNaN(Date.parse(`${dateText}T00:00:00Z`)) ? dateText : null;
  const firstSentence = text.split(/[.!?\n]/)[0]?.trim() ?? "";
  return {
    category,
    title: firstSentence.slice(0, 120),
    domain: null,
    skills,
    targetRole: null,
    targetCompany: null,
    location,
    workMode: /\bremote\b/i.test(text) ? "REMOTE" : null,
    deadline,
    urgency: /\b(urgent|asap|this week)\b/i.test(text) ? "HIGH" : "NORMAL",
  };
}

export async function autofillAsk(
  user: { id: string; instituteId: string },
  description: string,
): Promise<{ suggestion: AskSuggestion; usedFallback: boolean }> {
  const safe = redactContacts(description);
  if (await reserveAiCall(user, "ask.autofill")) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const suggestion = await generateJson({
        system: ASK_AUTOFILL_PROMPT.replace("{{TODAY}}", today),
        user: safe,
        schema: askSuggestionSchema,
      });
      return { suggestion: { ...suggestion, skills: normalizeSkills(suggestion.skills) }, usedFallback: false };
    } catch {
      // fall through to the keyword reader
    }
  }
  return { suggestion: autofillFallback(safe), usedFallback: true };
}
