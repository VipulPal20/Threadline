import { z } from "zod";
import { CATEGORY_LABELS } from "../domain/labels";
import type { AskCategory } from "../domain/constants";
import { reserveAiCall } from "./budget";
import { generateJson } from "./gemini";
import { REQUEST_DRAFT_PROMPT } from "./prompts";
import { containsContactDetails, redactContacts } from "./redact";

export interface DraftInput {
  ask: {
    title: string;
    category: string;
    description: string;
    targetRole: string | null;
    targetCompany: string | null;
    deadline: string | null;
  };
  student: { firstName: string; department: string | null; degree: string | null; graduationYear: number | null; headline: string | null; instituteName: string };
  alumnus: { firstName: string; currentTitle: string | null; currentCompany: string | null };
  /** Short phrases such as "sql", "Northstar Labs" or "Computer Science". At least one must appear in a draft. */
  sharedFacts: string[];
}

const draftSchema = z.object({ message: z.string().min(1).max(2000) });

const wordCount = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

/** Checks a model draft against the inputs. Returns the problems found; empty means it is safe to show. */
export function draftProblems(message: string, input: DraftInput): string[] {
  const problems: string[] = [];
  const known = JSON.stringify(input).toLowerCase();
  // Compare whole numbers, so "19" is not excused just because "2019" appears somewhere in the inputs.
  const knownNumbers = new Set(known.match(/\d+/g) ?? []);
  if (containsContactDetails(message)) problems.push("contains contact details or a link");
  for (const digits of new Set(message.match(/\d+/g) ?? [])) if (!knownNumbers.has(digits)) problems.push(`mentions a number not in the inputs (${digits})`);
  const words = wordCount(message);
  if (words < 50 || words > 170) problems.push(`has ${words} words`);
  if (input.ask.deadline && !message.includes(input.ask.deadline)) problems.push("leaves out the deadline");
  const lower = message.toLowerCase();
  if (input.sharedFacts.length && !input.sharedFacts.some((fact) => lower.includes(fact.toLowerCase()))) problems.push("mentions none of the shared facts");
  if (!lower.includes(input.alumnus.firstName.toLowerCase())) problems.push("does not greet the alumnus by name");
  return problems;
}

function firstSentence(text: string, max: number): string {
  const sentence = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** Deterministic message built only from the inputs. Used when Gemini is off, over its cap, or fails validation. */
export function templateDraft(input: DraftInput): string {
  const { ask, student, alumnus, sharedFacts } = input;
  const what = CATEGORY_LABELS[ask.category as AskCategory]?.toLowerCase() ?? "some guidance";
  const background = [student.degree, student.department].filter(Boolean).join(" in ");
  const intro = `I'm ${student.firstName}${background ? `, studying ${background}` : ""} at ${student.instituteName}.`;
  const fit = sharedFacts.length ? `I'm reaching out because of ${sharedFacts.slice(0, 2).join(" and ")}.` : "I'm reaching out through our institute's alumni network.";
  const detail = redactContacts(firstSentence(ask.description || ask.title, 220));
  const need = `I'm looking for ${what}. ${/[.!?…]$/.test(detail) ? detail : `${detail}.`}`;
  const goal = ask.targetRole ? ` I'm aiming for a ${ask.targetRole} role${ask.targetCompany ? ` at ${ask.targetCompany}` : ""}.` : "";
  const deadline = ask.deadline ? ` I'd ideally like to sort this by ${ask.deadline}.` : "";
  const role = alumnus.currentTitle ? `Given your work as ${alumnus.currentTitle}${alumnus.currentCompany ? ` at ${alumnus.currentCompany}` : ""}, ` : "";
  return `Hi ${alumnus.firstName}, ${intro} ${fit} ${need}${goal}${deadline} ${role}would you have time for a short chat or a quick bit of advice? Thank you for considering it, I really appreciate your time. ${student.firstName}`.replace(/\s+/g, " ");
}

/** A draft the student can edit before sending. Gemini first, validated; otherwise the template. */
export async function draftRequestMessage(
  user: { id: string; instituteId: string },
  input: DraftInput,
): Promise<{ message: string; usedFallback: boolean }> {
  if (await reserveAiCall(user, "request.draft")) {
    try {
      const { message } = await generateJson({
        system: REQUEST_DRAFT_PROMPT,
        user: JSON.stringify({
          ASK: input.ask,
          STUDENT: input.student,
          ALUMNUS: input.alumnus,
          SHARED_FACTS: input.sharedFacts,
        }),
        schema: draftSchema,
      });
      if (draftProblems(message.trim(), input).length === 0) return { message: message.trim(), usedFallback: false };
    } catch {
      // fall through to the template
    }
  }
  return { message: templateDraft(input), usedFallback: true };
}
