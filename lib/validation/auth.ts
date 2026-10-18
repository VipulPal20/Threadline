import { z } from "zod";
import { passwordProblem } from "../auth/password";

export const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

/** Agreeing to the Terms and Privacy Policy is required to create any account. */
const acceptTermsSchema = z.literal(true, { errorMap: () => ({ message: "Please agree to the Terms and the Privacy Policy." }) });

const nameSchema = z.string({ required_error: "Name is required." }).trim().min(2, "Enter your full name.").max(100);

/** Comma- or space-separated domains such as "college.edu, alumni.college.edu". */
const domainsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(/[\s,;]+/)))
  .transform((items) => Array.from(new Set(items.map((item) => item.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))))
  .refine((items) => items.length > 0, "Add at least one email domain.")
  .refine(
    (items) => items.every((item) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(item)),
    "Enter valid domains such as college.edu.",
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Password is required." }).min(1, "Password is required."),
  role: z.enum(["admin", "alumni", "student"]),
});

export const registerInstituteSchema = z.object({
  instituteName: z.string({ required_error: "Institute name is required." }).trim().min(2, "Enter the institute name.").max(120),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  domains: domainsSchema,
  acceptTerms: acceptTermsSchema,
});

export const registerMemberSchema = z.object({
  code: z.string({ required_error: "Institute code is required." }).trim().min(4, "Enter your institute code."),
  role: z.enum(["alumni", "student"]),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: acceptTermsSchema,
});

export const inviteCreateSchema = z.object({
  email: emailSchema,
  role: z.enum(["alumni", "student"]),
  name: nameSchema.optional(),
});

export const inviteAcceptSchema = z.object({
  token: z.string().min(10, "Invalid invite link."),
  name: nameSchema,
  password: passwordSchema,
  acceptTerms: acceptTermsSchema,
});

/** The services take the same fields without the checkbox, which the API has already checked. */
export type RegisterInstituteInput = Omit<z.infer<typeof registerInstituteSchema>, "acceptTerms">;
export type RegisterMemberInput = Omit<z.infer<typeof registerMemberSchema>, "acceptTerms">;
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export type InviteAcceptInput = Omit<z.infer<typeof inviteAcceptSchema>, "acceptTerms">;
