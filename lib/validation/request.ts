import { z } from "zod";
import { containsContactDetails } from "../ai/redact";

/** The opening message a student sends with a request. Email and phone are never shared. */
export const requestMessageSchema = z
  .string({ required_error: "Write a short message to introduce yourself." })
  .trim()
  .min(30, "Write a few sentences so they know what you need.")
  .max(1500, "Keep your message under 1,500 characters.")
  .refine((value) => !containsContactDetails(value), "Please don't include emails, phone numbers or links. You can talk in the chat once they accept.");

export const draftRequestSchema = z.object({
  askId: z.string().min(1),
  alumniId: z.string().min(1),
});

export const sendRequestSchema = draftRequestSchema.extend({
  message: requestMessageSchema,
});

export const declineSchema = z.object({
  reason: z.string().trim().max(300).nullish().transform((value) => value || null),
});
