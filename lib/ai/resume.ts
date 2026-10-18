import { normalizeSkills } from "../matching/skills-normalize";
import { reserveAiCall } from "./budget";
import { resumeFallback } from "./fallbacks";
import { generateJson } from "./gemini";
import { RESUME_SYSTEM_PROMPT } from "./prompts";
import { redactContacts } from "./redact";
import { resumeDraftSchema, type ResumeDraft } from "./schemas";

const MAX_RESUME_CHARS = 12_000;

/** Redacts contact details and bounds the length. Run before storing or sending anywhere. */
export function sanitizeResumeText(text: string): string {
  return redactContacts(text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_RESUME_CHARS);
}

export interface ResumeExtraction {
  draft: ResumeDraft;
  usedFallback: boolean;
}

/** Gemini extraction with a template fallback. The result is only ever a suggestion for the member to confirm. */
export async function extractResumeDraft(
  user: { id: string; instituteId: string },
  sanitizedText: string,
): Promise<ResumeExtraction> {
  if (await reserveAiCall(user, "resume.extract")) {
    try {
      const draft = await generateJson({ system: RESUME_SYSTEM_PROMPT, user: sanitizedText, schema: resumeDraftSchema });
      return { draft: { ...draft, skills: normalizeSkills(draft.skills) }, usedFallback: false };
    } catch {
      // Fall through to the local reader so onboarding never blocks on the language service.
    }
  }
  return { draft: resumeFallback(sanitizedText), usedFallback: true };
}
