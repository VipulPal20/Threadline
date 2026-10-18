import { db } from "../db";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../errors";
import { hashPassword } from "../auth/password";
import { hashToken, randomToken } from "../auth/tokens";
import { ROLE_BY_SLUG, type SessionUser } from "../auth/types";
import { MAX_BULK_INVITES, parseInviteCsv } from "../validation/admin";
import type { InviteAcceptInput, InviteCreateInput } from "../validation/auth";
import { emails } from "../email/templates";
import { sendEmail } from "../email/send";
import { termsAcceptance } from "../domain/legal";
import { recordEvent } from "./audit";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function inviteUrl(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

/** Emails the invite link. The admin also gets the link to copy, so a mail problem never blocks an invite. */
async function emailInvite(instituteId: string, invite: { email: string; name: string | null; role: string }, url: string): Promise<boolean> {
  const institute = await db.institute.findUnique({ where: { id: instituteId }, select: { name: true } });
  return sendEmail(emails.invite(invite, { instituteName: institute?.name ?? "your institute", role: invite.role === "ALUMNI" ? "alumni" : "student", url }));
}

/**
 * Creates an invite, emails it, and returns the one-time link. Only the token hash is stored, so the
 * link cannot be shown again later; the admin can copy it now if the email does not arrive.
 */
export async function createInvite(admin: SessionUser, rawInput: InviteCreateInput) {
  const input = { ...rawInput, email: rawInput.email.trim().toLowerCase() };
  if (admin.role !== "ADMIN") throw forbidden();
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw conflict("An account with this email already exists.");
  }
  const token = randomToken();
  const invite = await db.invite.create({
    data: {
      instituteId: admin.instituteId,
      email: input.email,
      role: ROLE_BY_SLUG[input.role],
      name: input.name ?? null,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedById: admin.id,
    },
  });
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: "invite.created", entity: "invite", entityId: invite.id, payload: { role: invite.role } });
  const url = inviteUrl(token);
  return { invite, url, emailed: await emailInvite(admin.instituteId, invite, url) };
}

export async function listInvites(admin: SessionUser) {
  if (admin.role !== "ADMIN") throw forbidden();
  const invites = await db.invite.findMany({
    where: { instituteId: admin.instituteId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, name: true, expiresAt: true, acceptedAt: true, createdAt: true },
  });
  const now = Date.now();
  return invites.map((invite) => ({
    ...invite,
    status: invite.acceptedAt ? "ACCEPTED" : invite.expiresAt.getTime() <= now ? "EXPIRED" : "PENDING",
  }));
}

async function findOpenInvite(token: string) {
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) }, include: { institute: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
    throw notFound("This invite link is invalid or has expired.");
  }
  return invite;
}

/** What the invite page may show before the invitee has signed in. */
export async function previewInvite(token: string) {
  const invite = await findOpenInvite(token);
  return { email: invite.email, name: invite.name, role: invite.role, instituteName: invite.institute.name };
}

/** Invited users skip the domain check and approval: the admin already vouched for them. */
export async function acceptInvite(input: InviteAcceptInput) {
  const invite = await findOpenInvite(input.token);
  if (await db.user.findUnique({ where: { email: invite.email } })) throw conflict("An account with this email already exists.");

  const passwordHash = await hashPassword(input.password);
  const user = await db.$transaction(async (tx) => {
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw badRequest("This invite has already been used.");
    return tx.user.create({
      data: {
        instituteId: invite.instituteId,
        role: invite.role,
        email: invite.email,
        passwordHash,
        ...termsAcceptance(),
        name: input.name,
        status: "ACTIVE",
      },
      select: { id: true, role: true, name: true, email: true, status: true, onboardingComplete: true },
    });
  });
  await recordEvent({ instituteId: invite.instituteId, actorId: user.id, kind: "invite.accepted", entity: "invite", entityId: invite.id });
  return user;
}

/**
 * Creates invites from a CSV (name,email,role). Rows that cannot be invited are returned with a reason
 * instead of stopping the rest. Each link is shown once, so the caller must hand it over right away.
 */
export async function bulkCreateInvites(admin: SessionUser, csv: string) {
  if (admin.role !== "ADMIN") throw forbidden();
  const { rows, rejected, tooMany } = parseInviteCsv(csv);
  const created: Array<{ line: number; email: string; role: string; url: string; emailed: boolean }> = [];
  const skipped = [...rejected];

  for (const row of rows) {
    try {
      const { invite, url, emailed } = await createInvite(admin, { email: row.email, role: row.role, name: row.name });
      created.push({ line: row.line, email: invite.email, role: invite.role, url, emailed });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      skipped.push({ line: row.line, email: row.email, reason: error.message });
    }
  }
  skipped.sort((a, b) => a.line - b.line);
  return { created, skipped, tooMany, limit: MAX_BULK_INVITES };
}

/** Gives an unused invite a fresh link and a fresh expiry. The old link stops working. */
export async function resendInvite(admin: SessionUser, inviteId: string) {
  if (admin.role !== "ADMIN") throw forbidden();
  const invite = await db.invite.findFirst({ where: { id: inviteId, instituteId: admin.instituteId } });
  if (!invite) throw notFound("Invite not found.");
  if (invite.acceptedAt) throw conflict("This invite has already been used.");
  if (await db.user.findUnique({ where: { email: invite.email } })) throw conflict("An account with this email already exists.");

  const token = randomToken();
  await db.invite.update({ where: { id: invite.id }, data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: "invite.resent", entity: "invite", entityId: invite.id });
  const url = inviteUrl(token);
  return { url, email: invite.email, emailed: await emailInvite(admin.instituteId, invite, url) };
}
