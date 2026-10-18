import { z } from "zod";
import { ASK_CATEGORIES, ASK_STATUSES } from "../domain/constants";
import { inviteCreateSchema } from "./auth";

/** Same rules as institute registration: comma or space separated domains such as "college.edu". */
const domains = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(/[\s,;]+/)))
  .transform((items) => Array.from(new Set(items.map((item) => item.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))))
  .refine((items) => items.length > 0, "Add at least one email domain.")
  .refine((items) => items.every((item) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(item)), "Enter valid domains such as college.edu.");

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the institute name.").max(120),
  allowedEmailDomains: domains,
  requireApproval: z.boolean(),
  requestExpiryHours: z.number({ invalid_type_error: "Enter a number of hours." }).int().min(1, "Use at least 1 hour.").max(720, "Use at most 720 hours (30 days)."),
  monthlyAskLimit: z.number({ invalid_type_error: "Enter a number of asks." }).int().min(1, "Allow at least 1 ask a month.").max(20, "Allow at most 20 asks a month."),
  aiEnabled: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const adminAskFilterSchema = z.object({
  status: z.enum(ASK_STATUSES).optional(),
  category: z.enum(ASK_CATEGORIES).optional(),
  domain: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminAskFilter = z.infer<typeof adminAskFilterSchema>;

export const bulkInviteSchema = z.object({ csv: z.string().min(1, "Choose a CSV file.").max(200_000, "That file is too large.") });

export const MAX_BULK_INVITES = 200;

export interface ParsedInviteRow {
  line: number;
  email: string;
  role: "student" | "alumni";
  name?: string;
}

export interface RejectedInviteRow {
  line: number;
  email: string;
  reason: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Reads "name,email,role" rows (a header row is optional and its columns may be in any order).
 * Bad rows are reported with their line number instead of failing the whole file.
 */
export function parseInviteCsv(text: string): { rows: ParsedInviteRow[]; rejected: RejectedInviteRow[]; tooMany: boolean } {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line })).filter((entry) => entry.text.trim());
  let columns = { name: 0, email: 1, role: 2 };
  const first = lines[0] ? splitCsvLine(lines[0].text).map((cell) => cell.toLowerCase()) : [];
  if (first.length && !first.some((cell) => cell.includes("@"))) {
    const find = (label: string) => first.findIndex((cell) => cell === label);
    if (find("email") >= 0) columns = { name: find("name"), email: find("email"), role: find("role") };
    lines.shift();
  }

  const rows: ParsedInviteRow[] = [];
  const rejected: RejectedInviteRow[] = [];
  const seen = new Set<string>();
  const limited = lines.slice(0, MAX_BULK_INVITES);
  for (const { line, text: raw } of limited) {
    const cells = splitCsvLine(raw);
    const email = (cells[columns.email] ?? "").toLowerCase();
    const parsed = inviteCreateSchema.safeParse({
      email,
      role: (cells[columns.role] ?? "").toLowerCase(),
      name: columns.name >= 0 && cells[columns.name] ? cells[columns.name] : undefined,
    });
    if (!parsed.success) {
      rejected.push({ line, email, reason: parsed.error.issues[0]?.message ?? "Invalid row." });
    } else if (seen.has(parsed.data.email)) {
      rejected.push({ line, email: parsed.data.email, reason: "Listed twice in this file." });
    } else {
      seen.add(parsed.data.email);
      rows.push({ line, email: parsed.data.email, role: parsed.data.role, name: parsed.data.name });
    }
  }
  return { rows, rejected, tooMany: lines.length > MAX_BULK_INVITES };
}
