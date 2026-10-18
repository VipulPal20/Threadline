import { db } from "../db";
import { hashPassword } from "../auth/password";
import { destroyAllSessions } from "../auth/session";
import { hashToken, randomToken } from "../auth/tokens";
import type { SessionUser } from "../auth/types";
import { conflict, forbidden, notFound } from "../errors";
import { emails } from "../email/templates";
import { sendEmail } from "../email/send";
import { recordEvent } from "./audit";

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export function resetUrl(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/reset/${token}`;
}

/**
 * An admin makes a one-time link for a student or alumnus who is locked out. The link is emailed to them, and
 * the admin can also copy it. Any earlier unused link for that person stops working.
 */
export async function createResetLink(admin: SessionUser, userId: string) {
  if (admin.role !== "ADMIN") throw forbidden();
  const user = await db.user.findFirst({ where: { id: userId, instituteId: admin.instituteId, role: { in: ["STUDENT", "ALUMNI"] } } });
  if (!user) throw notFound("Member not found.");
  if (user.status !== "ACTIVE") throw conflict("Only active members can have their password reset.");

  const token = randomToken();
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), createdById: admin.id } }),
  ]);
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: "password.reset.created", entity: "user", entityId: user.id });
  const url = resetUrl(token);
  const emailed = await sendEmail(emails.passwordReset(user, url));
  return { url, name: user.name, email: user.email, emailed };
}

async function findOpenReset(token: string) {
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now() || reset.user.status !== "ACTIVE") {
    throw notFound("This reset link is invalid or has expired. Ask your institute admin for a new one.");
  }
  return reset;
}

/** What the reset page may show before the person has chosen a password. */
export async function previewReset(token: string) {
  const reset = await findOpenReset(token);
  return { name: reset.user.name, role: reset.user.role };
}

/** Sets the new password, uses up the link and signs the person out everywhere. */
export async function completeReset(token: string, password: string) {
  const reset = await findOpenReset(token);
  const passwordHash = await hashPassword(password);
  const claimed = await db.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) throw notFound("This reset link has already been used.");
  await db.user.update({ where: { id: reset.userId }, data: { passwordHash } });
  await destroyAllSessions(reset.userId);
  await recordEvent({ instituteId: reset.user.instituteId, actorId: reset.userId, kind: "password.reset.used", entity: "user", entityId: reset.userId });
  return { role: reset.user.role };
}
