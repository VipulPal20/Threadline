import { z } from "zod";

export const messageSchema = z.object({
  body: z.string({ required_error: "Write a message first." }).trim().min(1, "Write a message first.").max(2000, "Keep messages under 2,000 characters."),
  aiAssisted: z.boolean().optional().default(false),
});

export const assistSchema = z.object({
  task: z.enum(["suggest", "improve", "summarise"]),
  text: z.string().trim().max(2000).optional(),
});

export const resolveSchema = z.object({
  rating: z.number({ required_error: "Choose a rating.", invalid_type_error: "Choose a rating." }).int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").nullish().transform((value) => value || null),
});
