import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";
import { destroyAllSessions } from "../auth/session";
import { randomToken } from "../auth/tokens";
import type { SessionUser } from "../auth/types";
import { ApiError, badRequest, forbidden } from "../errors";
import { recordEvent } from "./audit";
import { cancelAsk } from "./asks";
import { endConversation } from "./conversations";
import { declineRequest, withdrawRequest } from "./requests";
import { resumeDir } from "./resumes";

export async function setEmailNotifications(user: SessionUser, enabled: boolean): Promise<void> {
  await db.user.update({ where: { id: user.id }, data: { emailNotifications: enabled } });
}

export async function getAccountSettings(user: SessionUser) {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailNotifications: true, termsAcceptedAt: true, termsVersion: true } });
  return { emailNotifications: row.emailNotifications, termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null, termsVersion: row.termsVersion };
}

/**
 * A copy of what Threadline holds about this person, as plain JSON they can download.
 * It never includes the password hash or anyone else's email or phone.
 */
export async function exportMyData(user: SessionUser) {
  const [account, studentProfile, alumniProfile, experiences, educations, skills, resumes, asks, sent, received, notifications] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true, emailNotifications: true, termsAcceptedAt: true, termsVersion: true, institute: { select: { name: true } } },
    }),
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.alumniProfile.findUnique({ where: { userId: user.id } }),
    db.experience.findMany({ where: { userId: user.id } }),
    db.education.findMany({ where: { userId: user.id } }),
    db.userSkill.findMany({ where: { userId: user.id }, include: { skill: true } }),
    db.resume.findMany({ where: { userId: user.id }, select: { fileName: true, size: true, uploadedAt: true } }),
    db.ask.findMany({ where: { studentId: user.id }, include: { skills: { include: { skill: true } } }, orderBy: { createdAt: "asc" } }),
    db.introRequest.findMany({ where: { studentId: user.id }, include: { alumni: { select: { name: true } }, ask: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
    db.introRequest.findMany({ where: { alumniId: user.id }, include: { student: { select: { name: true } }, ask: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const conversations = await db.conversation.findMany({
    where: { introRequest: { OR: [{ studentId: user.id }, { alumniId: user.id }] } },
    include: { messages: { orderBy: { createdAt: "asc" } }, introRequest: { select: { ask: { select: { title: true } } } } },
  });

  return {
    exportedAt: new Date().toISOString(),
    account: { ...account, institute: account.institute.name },
    studentProfile,
    // Capacity and the pause switch are the alumnus's own settings, so they are theirs to see.
    alumniProfile,
    experiences,
    educations,
    skills: skills.map((row) => ({ name: row.skill.name, level: row.level })),
    resumes,
    asks: asks.map((ask) => ({ ...ask, skills: ask.skills.map((row) => ({ name: row.skill.name, importance: row.importance })) })),
    requestsSent: sent.map((row) => ({ ask: row.ask.title, to: row.alumni.name, state: row.state, message: row.initialMessage, sentAt: row.createdAt })),
    requestsReceived: received.map((row) => ({ ask: row.ask.title, from: row.student.name, state: row.state, message: row.initialMessage, receivedAt: row.createdAt })),
    conversations: conversations.map((conversation) => ({
      about: conversation.introRequest.ask.title,
      status: conversation.status,
      messages: conversation.messages.map((message) => ({ mine: message.senderId === user.id, body: message.body, at: message.createdAt })),
    })),
    notifications: notifications.map((row) => ({ kind: row.kind, at: row.createdAt, read: Boolean(row.readAt) })),
  };
}

/** Runs one cleanup step and ignores "already changed" conflicts, which just mean the work was already done. */
async function tolerant(step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
}

/**
 * Deletes a student's or alumnus's own account after they confirm their password.
 * Open work is closed properly first (requests withdrawn or declined, conversations ended, asks cancelled), then
 * personal details are erased: profile, skills, résumé, notifications and sessions go, message and ask text is
 * blanked, and the name and email are replaced by placeholders. Counts for the institute's metrics are kept.
 */
export async function deleteMyAccount(user: SessionUser, password: string) {
  if (user.role === "ADMIN") throw forbidden("Institute admin accounts can't be deleted here. Contact support to close your institute.");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(password, row.passwordHash))) throw badRequest("That password is not correct.");

  // 1. Close open work through the normal paths so the other people are told and their state stays consistent.
  if (user.role === "STUDENT") {
    const asks = await db.ask.findMany({ where: { studentId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } });
    for (const ask of asks) await tolerant(() => cancelAsk(user, ask.id));
    const pending = await db.introRequest.findMany({ where: { studentId: user.id, state: "PENDING" }, select: { id: true } });
    for (const request of pending) await tolerant(() => withdrawRequest(user, request.id));
  } else {
    const pending = await db.introRequest.findMany({ where: { alumniId: user.id, state: "PENDING" }, select: { id: true } });
    for (const request of pending) await tolerant(() => declineRequest(user, request.id, "This alumnus has left Threadline."));
  }
  const live = await db.conversation.findMany({
    where: { status: "ACTIVE", introRequest: { OR: [{ studentId: user.id }, { alumniId: user.id }] } },
    select: { id: true },
  });
  for (const conversation of live) await tolerant(() => endConversation(user, conversation.id));

  // 2. Erase personal data.
  const resumes = await db.resume.findMany({ where: { userId: user.id }, select: { storagePath: true } });
  for (const resume of resumes) await unlink(path.join(resumeDir(), path.basename(resume.storagePath))).catch(() => undefined);

  const placeholderHash = await hashPassword(randomToken());
  await db.$transaction([
    db.message.updateMany({ where: { senderId: user.id }, data: { body: "[message deleted]" } }),
    db.askSkill.deleteMany({ where: { ask: { studentId: user.id } } }),
    db.ask.updateMany({ where: { studentId: user.id }, data: { title: "Deleted ask", description: "[deleted]", domain: null, targetRole: null, targetCompany: null, location: null, resolutionNote: null } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.passwordReset.deleteMany({ where: { userId: user.id } }),
    db.userSkill.deleteMany({ where: { userId: user.id } }),
    db.experience.deleteMany({ where: { userId: user.id } }),
    db.education.deleteMany({ where: { userId: user.id } }),
    db.resume.deleteMany({ where: { userId: user.id } }),
    db.studentProfile.deleteMany({ where: { userId: user.id } }),
    db.alumniProfile.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted user",
        email: `deleted-${user.id}@deleted.invalid`,
        phone: null,
        passwordHash: placeholderHash,
        status: "DELETED",
        deletedAt: new Date(),
        emailNotifications: false,
        onboardingComplete: false,
      },
    }),
  ]);
  await destroyAllSessions(user.id);
  await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "account.deleted", entity: "user", entityId: user.id, payload: { role: user.role } });
}
