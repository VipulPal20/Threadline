import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";

/**
 * The only file that talks to Gemini. Callers must treat AiError as "use the template fallback".
 * Errors deliberately carry no prompt, response or key material.
 */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 15_000;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError("Gemini is not configured.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function parseJson(raw: string): unknown {
  const stripped = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) throw new AiError("The model returned invalid JSON.");
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      throw new AiError("The model returned invalid JSON.");
    }
  }
}

async function generateText(system: string, user: string, json: boolean, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await getClient().models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: json ? 0 : 0.4,
        ...(json ? { responseMimeType: "application/json" } : {}),
        abortSignal: controller.signal,
      },
    });
    const text = response.text?.trim();
    if (!text) throw new AiError("The model returned no content.");
    return text;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError("The language service could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

/** JSON completion validated against a zod schema, with one retry that feeds the validation error back. */
export async function generateJson<T>(options: {
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let user = options.user;
  let lastIssue = "invalid output";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await generateText(options.system, user, true, timeoutMs);
    try {
      const parsed = options.schema.safeParse(parseJson(raw));
      if (parsed.success) return parsed.data;
      lastIssue = parsed.error.issues.map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`).join("; ");
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      lastIssue = error.message;
    }
    user = `${options.user}\n\nYour previous output failed validation (${lastIssue}). Return only valid JSON that follows the schema.`;
  }
  throw new AiError("The model output did not match the expected format.");
}

/** Plain-text completion for drafts that land in an editable box. */
export function generateTextCompletion(options: { system: string; user: string; timeoutMs?: number }): Promise<string> {
  return generateText(options.system, options.user, false, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}
