import { z } from "zod";
import {
  ASK_CATEGORIES,
  EXPERIENCE_TYPES,
  LIMITS,
  SKILL_LEVELS,
  WORK_MODES,
} from "../domain/constants";

/** Optional text: undefined = leave unchanged, "" or null = clear. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value || null));

const url = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((value) => (value === undefined ? undefined : value || null))
  .refine((value) => !value || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value), "Enter a full link starting with https://");

const int = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label} must be a number.` }).int().min(min, `${label} is too low.`).max(max, `${label} is too high.`).nullish();

const list = (maxItems: number, maxLength = 80) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(maxItems, `Add at most ${maxItems} items.`)
    .optional();

const yearMonth = z
  .string()
  .trim()
  .regex(/^\d{4}(-\d{2})?$/, "Use YYYY or YYYY-MM.")
  .nullish()
  .transform((value) => value || null);

export const experienceSchema = z.object({
  type: z.enum(EXPERIENCE_TYPES).default("JOB"),
  title: z.string().trim().min(1, "Add a title for each experience.").max(120),
  organisation: text(120),
  startDate: yearMonth,
  endDate: yearMonth,
  isCurrent: z.boolean().default(false),
  description: text(1000),
});

export const educationSchema = z.object({
  institution: z.string().trim().min(1, "Add the institution for each education entry.").max(160),
  degree: text(120),
  field: text(120),
  startYear: int(1950, 2100, "Start year"),
  endYear: int(1950, 2100, "End year"),
  grade: text(40),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(40),
  level: z.enum(SKILL_LEVELS).default("INTERMEDIATE"),
  years: z.number().min(0).max(60).nullish(),
});

const sharedShape = {
  name: z.string().trim().min(2, "Enter your full name.").max(100).optional(),
  phone: text(30),
  department: text(100),
  degree: text(100),
  graduationYear: int(1950, 2100, "Graduation year"),
  city: text(80),
  headline: text(120),
  bio: text(1500),
  linkedinUrl: url,
  experiences: z.array(experienceSchema).max(15).optional(),
  educations: z.array(educationSchema).max(6).optional(),
  skills: z.array(skillSchema).max(40, "Add at most 40 skills.").optional(),
  /** True on the final wizard step: validates required fields and completes onboarding. */
  submit: z.boolean().optional(),
};

export const studentProfileSchema = z.object({
  ...sharedShape,
  enrollmentNo: text(40),
  currentYear: int(1, 8, "Current year"),
  cgpa: z.number().min(0, "CGPA is too low.").max(10, "CGPA cannot be above 10.").nullish(),
  targetRoles: list(8),
  targetCompanies: list(10),
  interestedDomains: list(8),
  preferredLocations: list(8),
  githubUrl: url,
  portfolioUrl: url,
});

export const alumniProfileSchema = z.object({
  ...sharedShape,
  currentCompany: text(120),
  currentTitle: text(120),
  industry: text(100),
  yearsExperience: int(0, 60, "Years of experience"),
  workMode: z.enum(WORK_MODES).nullish(),
  helpTypes: z.array(z.enum(ASK_CATEGORIES)).max(ASK_CATEGORIES.length).optional(),
  referralCompanies: list(10, 120),
  maxActiveConnections: int(LIMITS.minAlumniCapacity, LIMITS.maxAlumniCapacity, "Capacity").optional(),
  acceptingRequests: z.boolean().optional(),
});

export const alumniSettingsSchema = z.object({
  maxActiveConnections: z
    .number({ invalid_type_error: "Capacity must be a number." })
    .int()
    .min(LIMITS.minAlumniCapacity, `Choose at least ${LIMITS.minAlumniCapacity}.`)
    .max(LIMITS.maxAlumniCapacity, `Choose at most ${LIMITS.maxAlumniCapacity}.`),
  acceptingRequests: z.boolean(),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type AlumniProfileInput = z.infer<typeof alumniProfileSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
