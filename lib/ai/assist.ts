import { reserveAiCall } from "./budget";
import { generateTextCompletion } from "./gemini";
import { ASSIST_IMPROVE_PROMPT, ASSIST_SUGGEST_PROMPT, ASSIST_SUMMARISE_PROMPT } from "./prompts";
import { containsContactDetails, redactContacts } from "./redact";

export type AssistTask = "suggest" | "improve" | "summarise";

export interface AssistContext {
  ask: { title: string; category: string; description: string };
  me: { role: "student" | "alumnus"; firstName: string };
  other: { role: "student" | "alumnus"; firstName: string };
  /** Latest messages, oldest first. */
  messages: Array<{ from: "me" | "them"; text: string }>;
  draft?: string;
}

const MAX_CONTEXT_MESSAGES = 20;
const MAX_OUTPUT = { suggest: 1200, improve: 2000, summarise: 900 } as const;

/** Everything sent to the model is stripped of emails, phone numbers and links first. */
function safeContext(context: AssistContext, task: AssistTask) {
  return JSON.stringify({
    ASK: { title: redactContacts(context.ask.title), category: context.ask.category, description: redactContacts(context.ask.description).slice(0, 600) },
    ME: context.me,
    OTHER: context.other,
    MESSAGES: context.messages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({ from: message.from, text: redactContacts(message.text).slice(0, 600) })),
    ...(task === "improve" ? { DRAFT: redactContacts(context.draft ?? "") } : {}),
  });
}

const SYSTEM: Record<AssistTask, string> = { suggest: ASSIST_SUGGEST_PROMPT, improve: ASSIST_IMPROVE_PROMPT, summarise: ASSIST_SUMMARISE_PROMPT };

const cleanText = (text: string) => text.replace(/^["“]|["”]$/g, "").trim();

/** Why a model reply is not acceptable. Empty means it can be shown. */
export function assistProblems(task: AssistTask, text: string, context: AssistContext): string[] {
  const problems: string[] = [];
  if (!text) problems.push("empty");
  if (text.length > MAX_OUTPUT[task]) problems.push("too long");
  if (containsContactDetails(text)) problems.push("contains contact details or a link");
  if (task === "improve" && context.draft && text.length > context.draft.length * 1.2 + 40) problems.push("much longer than the draft");
  return problems;
}

function latestFromThem(context: AssistContext): string | undefined {
  return [...context.messages].reverse().find((message) => message.from === "them")?.text;
}

/** Plain, honest fallbacks. They only use words already in the conversation. */
export function assistFallback(task: AssistTask, context: AssistContext): string {
  if (task === "improve") {
    const tidy = (context.draft ?? "").replace(/\s+/g, " ").trim();
    const capped = tidy ? tidy[0]!.toUpperCase() + tidy.slice(1) : tidy;
    return capped && !/[.!?…]$/.test(capped) ? `${capped}.` : capped;
  }
  if (task === "summarise") {
    const mine = context.messages.filter((message) => message.from === "me").length;
    const theirs = context.messages.length - mine;
    const last = context.messages[context.messages.length - 1];
    const lines = [`- About: ${context.ask.title}`, `- ${context.messages.length} messages so far (${mine} from you, ${theirs} from ${context.other.firstName})`];
    if (last) lines.push(`- Latest from ${last.from === "me" ? "you" : context.other.firstName}: "${redactContacts(last.text).slice(0, 140)}${last.text.length > 140 ? "…" : ""}"`);
    return lines.join("\n");
  }
  const them = context.other.firstName;
  if (context.me.role === "student") {
    return latestFromThem(context)
      ? `Thank you, ${them}, that's really helpful. Would you be able to suggest a time for a short call, or the best next step for me to take? I'm happy to work around your schedule.\n\n${context.me.firstName}`
      : `Hi ${them}, thank you for accepting. Is there anything more you'd like to know about what I'm looking for? I'm happy to share more detail.\n\n${context.me.firstName}`;
  }
  return latestFromThem(context)
    ? `Thanks for the update, ${them}. Happy to help. Could you tell me a little more about where you're stuck right now, so I can point you in the right direction?\n\n${context.me.firstName}`
    : `Hi ${them}, thanks for reaching out. I'd be glad to help. What would be the most useful thing to cover first?\n\n${context.me.firstName}`;
}

/** Gemini first (with output checks); the plain fallback otherwise. The result is only ever shown, never sent automatically. */
export async function assist(
  user: { id: string; instituteId: string },
  task: AssistTask,
  context: AssistContext,
): Promise<{ text: string; usedFallback: boolean }> {
  if (await reserveAiCall(user, `chat.${task}`)) {
    try {
      const text = cleanText(await generateTextCompletion({ system: SYSTEM[task], user: safeContext(context, task) }));
      if (assistProblems(task, text, context).length === 0) return { text, usedFallback: false };
    } catch {
      // fall through
    }
  }
  return { text: assistFallback(task, context), usedFallback: true };
}
