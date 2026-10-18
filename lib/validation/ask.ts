import { z } from "zod";
import { ASK_CATEGORIES, SKILL_IMPORTANCE, URGENCIES, WORK_MODES } from "../domain/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .nullish()
    .transform((value) => value || null);

/** Calendar date YYYY-MM-DD that is today or later. */
const deadline = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Use a valid date.")
  .refine((value) => value >= new Date().toISOString().slice(0, 10), "The deadline cannot be in the past.")
  .nullish()
  .transform((value) => value || null);

export const askSkillSchema = z.object({
  name: z.string().trim().min(1).max(40),
  importance: z.enum(SKILL_IMPORTANCE).default("MUST"),
});

export const askSchema = z
  .object({
    category: z.enum(ASK_CATEGORIES, { errorMap: () => ({ message: "Choose what kind of help you need." }) }),
    title: z.string().trim().min(5, "Give your ask a short title.").max(120),
    description: z.string().trim().min(20, "Describe what you need in at least a sentence or two.").max(2000),
    domain: optionalText(100),
    targetRole: optionalText(120),
    targetCompany: optionalText(120),
    location: optionalText(80),
    workMode: z.enum(WORK_MODES).nullish().transform((value) => value ?? null),
    deadline,
    urgency: z.enum(URGENCIES).default("NORMAL"),
    skills: z.array(askSkillSchema).min(1, "Add at least one skill you need help with.").max(12, "Add at most 12 skills."),
  })
  .superRefine((value, ctx) => {
    if (value.category === "referral" && !value.targetCompany) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetCompany"], message: "Tell us which company you want a referral to." });
    }
  });

export const autofillSchema = z.object({
  description: z.string().trim().min(10, "Write a sentence or two first.").max(2000),
});

export type AskInput = z.infer<typeof askSchema>;

/** What autofill returns: suggestions only; the student reviews every field before posting. */
export const askSuggestionSchema = z.object({
  category: z.enum(ASK_CATEGORIES).catch("career_advice"),
  title: z.string().max(120).catch(""),
  domain: z.string().max(100).nullable().catch(null),
  skills: z.array(z.string().min(1).max(40)).max(12).catch([]),
  targetRole: z.string().max(120).nullable().catch(null),
  targetCompany: z.string().max(120).nullable().catch(null),
  location: z.string().max(80).nullable().catch(null),
  workMode: z.enum(WORK_MODES).nullable().catch(null),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null),
  urgency: z.enum(URGENCIES).catch("NORMAL"),
});

export type AskSuggestion = z.infer<typeof askSuggestionSchema>;
