import { randomInt } from "node:crypto";
import { db } from "../db";
import { conflict, notFound } from "../errors";
import { parseList, toList } from "../json";
import { hashPassword } from "../auth/password";
import type { RegisterInstituteInput } from "../validation/auth";
import { termsAcceptance } from "../domain/legal";
import { recordEvent } from "./audit";

// No 0/O/1/I so codes survive being read aloud or copied by hand.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodePart(length: number): string {
  let part = "";
  for (let index = 0; index < length; index += 1) part += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return part;
}

export function normaliseJoinCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function generateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${randomCodePart(4)}-${randomCodePart(4)}`;
    if (!(await db.institute.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique join code.");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "institute";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let suffix = 2; await db.institute.findUnique({ where: { slug } }); suffix += 1) slug = `${base}-${suffix}`;
  return slug;
}

/** Creates an institute and its first admin in one transaction. */
export async function registerInstitute(rawInput: RegisterInstituteInput) {
  const input = { ...rawInput, email: rawInput.email.trim().toLowerCase() };
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw conflict("An account with this email already exists.");
  }
  const [joinCode, slug, passwordHash] = await Promise.all([
    generateJoinCode(),
    uniqueSlug(input.instituteName),
    hashPassword(input.password),
  ]);

  const { institute, admin } = await db.$transaction(async (tx) => {
    const institute = await tx.institute.create({
      data: { name: input.instituteName, slug, joinCode, allowedEmailDomains: toList(input.domains) },
    });
    const admin = await tx.user.create({
      data: {
        instituteId: institute.id,
        role: "ADMIN",
        email: input.email,
        passwordHash,
        ...termsAcceptance(),
        name: input.name,
        status: "ACTIVE",
        onboardingComplete: true,
      },
    });
    return { institute, admin };
  });

  await recordEvent({ instituteId: institute.id, actorId: admin.id, kind: "institute.created", entity: "institute", entityId: institute.id });
  return { institute, admin };
}

export async function findInstituteByCode(code: string) {
  return db.institute.findUnique({ where: { joinCode: normaliseJoinCode(code) } });
}

export async function getInstitute(instituteId: string) {
  const institute = await db.institute.findUnique({ where: { id: instituteId } });
  if (!institute) throw notFound("Institute not found.");
  return institute;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** True when the email's domain equals, or is a subdomain of, an allowed institute domain. */
export function isAllowedDomain(email: string, allowedEmailDomains: string): boolean {
  const domain = emailDomain(email);
  return parseList(allowedEmailDomains).some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}
