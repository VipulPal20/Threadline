import { z } from "zod";
import { EXPERIENCE_TYPES } from "../domain/constants";

const yearMonth = z.string().regex(/^\d{4}(-\d{2})?$/).nullable();

/** What résumé extraction produces. The member reviews and edits it before anything is saved. */
export const resumeDraftSchema = z.object({
  headline: z.string().max(120).nullable(),
  roles: z
    .array(
      z.object({
        type: z.enum(EXPERIENCE_TYPES).catch("JOB"),
        title: z.string().min(1).max(120),
        organisation: z.string().max(120).nullable(),
        start: yearMonth.catch(null),
        end: yearMonth.catch(null),
        isCurrent: z.boolean().catch(false),
        description: z.string().max(600).nullable().catch(null),
      }),
    )
    .max(10),
  education: z
    .array(
      z.object({
        institution: z.string().min(1).max(160),
        degree: z.string().max(120).nullable(),
        field: z.string().max(120).nullable().catch(null),
        startYear: z.number().int().nullable().catch(null),
        endYear: z.number().int().nullable().catch(null),
      }),
    )
    .max(5),
  skills: z.array(z.string().min(1).max(40)).max(30),
});

export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
