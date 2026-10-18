import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { SessionUser } from "../auth/types";
import type { AskCategory } from "../domain/constants";
import { publicAlumniProfile, publicStudentProfile } from "../dto/profile";
import { forbidden, notFound } from "../errors";
import { parseList, toList } from "../json";
import type { AdminAskFilter, SettingsInput } from "../validation/admin";
import { recordEvent } from "./audit";
import { expireAsks } from "./asks";
import { expireRequests } from "./expiry";
import { generateJoinCode, getInstitute } from "./institutes";
import { getAlumniProfile, getStudentProfile } from "./profiles";

export const ADMIN_PAGE_SIZE = 25;

function assertAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw forbidden();
}

/* --------------------------------- asks ---------------------------------- */

export async function listAdminAsks(admin: SessionUser, filter: AdminAskFilter) {
  assertAdmin(admin);
  await Promise.all([expireAsks(admin.instituteId), expireRequests(admin.instituteId)]);
  const where: Prisma.AskWhereInput = {
    instituteId: admin.instituteId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.domain ? { domain: { contains: filter.domain, mode: "insensitive" } } : {}),
    ...(filter.q ? { OR: [{ title: { contains: filter.q, mode: "insensitive" } }, { student: { name: { contains: filter.q, mode: "insensitive" } } }] } : {}),
    ...(filter.from || filter.to
      ? { createdAt: { ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}), ...(filter.to ? { lte: new Date(`${filter.to}T23:59:59.999Z`) } : {}) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.ask.count({ where }),
    db.ask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { student: { select: { id: true, name: true } }, requests: { select: { conversation: { select: { id: true } } } } },
    }),
  ]);
  return {
    total,
    page: filter.page,
    pageSize: ADMIN_PAGE_SIZE,
    rows: rows.map((ask) => ({
      id: ask.id,
      title: ask.title,
      category: ask.category,
      domain: ask.domain,
      status: ask.status,
      createdAt: ask.createdAt.toISOString(),
      resolvedAt: ask.resolvedAt?.toISOString() ?? null,
      rating: ask.rating,
      student: ask.student,
      requests: ask.requests.length,
      accepted: ask.requests.some((request) => request.conversation !== null),
    })),
  };
}

export interface TimelineEvent {
  at: string;
  kind: "ask" | "match" | "request" | "response" | "conversation" | "resolution";
  text: string;
}

/**
 * The full journey of one ask for the institute: what was shown, who was asked, how they answered.
 * Only metadata is returned: no message text, no decline reasons and no résumé or contact details.
 */
export async function getAdminAsk(admin: SessionUser, askId: string) {
  assertAdmin(admin);
  await Promise.all([expireAsks(admin.instituteId), expireRequests(admin.instituteId)]);
  const ask = await db.ask.findFirst({
    where: { id: askId, instituteId: admin.instituteId },
    include: {
      student: { select: { id: true, name: true } },
      skills: { include: { skill: true } },
      snapshots: { orderBy: [{ computedAt: "asc" }, { rank: "asc" }], include: { alumni: { select: { name: true } } } },
      requests: {
        orderBy: { createdAt: "asc" },
        include: { alumni: { select: { id: true, name: true } }, conversation: { select: { id: true, createdAt: true, status: true, lastMessageAt: true, _count: { select: { messages: true } } } } },
      },
    },
  });
  if (!ask) throw notFound("Ask not found.");

  const events: TimelineEvent[] = [{ at: ask.createdAt.toISOString(), kind: "ask", text: `Ask posted by ${ask.student.name}` }];

  const batches = new Map<number, typeof ask.snapshots>();
  for (const snapshot of ask.snapshots) batches.set(snapshot.computedAt.getTime(), [...(batches.get(snapshot.computedAt.getTime()) ?? []), snapshot]);
  for (const [time, batch] of batches) {
    events.push({ at: new Date(time).toISOString(), kind: "match", text: `Top matches shown: ${batch.map((row) => `${row.alumni.name} (${Math.round(row.score)}%)`).join(", ")}` });
  }

  for (const request of ask.requests) {
    const who = request.alumni.name;
    events.push({ at: request.createdAt.toISOString(), kind: "request", text: `Request sent to ${who}` });
    if (request.state === "DECLINED" && request.respondedAt) events.push({ at: request.respondedAt.toISOString(), kind: "response", text: `${who} declined` });
    if (request.state === "EXPIRED" && request.closedAt) events.push({ at: request.closedAt.toISOString(), kind: "response", text: `Request to ${who} expired without an answer` });
    if (request.state === "WITHDRAWN" && request.closedAt) events.push({ at: request.closedAt.toISOString(), kind: "response", text: `Request to ${who} was withdrawn` });
    if (request.conversation) {
      if (request.respondedAt) events.push({ at: request.respondedAt.toISOString(), kind: "response", text: `${who} accepted` });
      events.push({ at: request.conversation.createdAt.toISOString(), kind: "conversation", text: "Conversation started" });
      const messages = request.conversation._count.messages;
      if (messages > 1) events.push({ at: request.conversation.lastMessageAt.toISOString(), kind: "conversation", text: `${messages} messages exchanged (text is private)` });
      if (request.state === "CLOSED" && request.closedAt && ask.status !== "RESOLVED") events.push({ at: request.closedAt.toISOString(), kind: "conversation", text: "Conversation ended without resolving the ask" });
    }
  }
  if (ask.status === "RESOLVED" && ask.resolvedAt) events.push({ at: ask.resolvedAt.toISOString(), kind: "resolution", text: `Marked resolved${ask.rating ? `, rated ${ask.rating}/5` : ""}` });
  if (ask.status === "EXPIRED") events.push({ at: ask.updatedAt.toISOString(), kind: "resolution", text: "Ask expired at its deadline" });
  if (ask.status === "CANCELLED") events.push({ at: ask.updatedAt.toISOString(), kind: "resolution", text: "Ask cancelled by the student" });
  events.sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: ask.id,
    title: ask.title,
    category: ask.category,
    categoryLabel: ask.category as AskCategory,
    domain: ask.domain,
    targetRole: ask.targetRole,
    targetCompany: ask.targetCompany,
    location: ask.location,
    deadline: ask.deadline ? ask.deadline.toISOString().slice(0, 10) : null,
    urgency: ask.urgency,
    status: ask.status,
    rating: ask.rating,
    student: ask.student,
    skills: ask.skills.map((row) => ({ name: row.skill.name, importance: row.importance })),
    timeline: events,
  };
}

/* --------------------------------- users --------------------------------- */

/** One member as the admin sees them: public profile fields only, never capacity or contact details beyond email. */
export async function getAdminUser(admin: SessionUser, userId: string) {
  assertAdmin(admin);
  const user = await db.user.findFirst({
    where: { id: userId, instituteId: admin.instituteId, role: { in: ["STUDENT", "ALUMNI"] } },
    select: { id: true, name: true, email: true, role: true, status: true, onboardingComplete: true, createdAt: true, lastLoginAt: true },
  });
  if (!user) throw notFound("Member not found.");

  if (user.role === "STUDENT") {
    const view = await getStudentProfile(user.id);
    const [asks, resolved] = await Promise.all([db.ask.count({ where: { studentId: user.id } }), db.ask.count({ where: { studentId: user.id, status: "RESOLVED" } })]);
    return { user, completeness: view.completeness.percent, stats: { asks, resolved }, student: publicStudentProfile(view), alumnus: null };
  }
  const view = await getAlumniProfile(user.id);
  const [received, accepted] = await Promise.all([
    db.introRequest.count({ where: { alumniId: user.id } }),
    db.introRequest.count({ where: { alumniId: user.id, conversation: { isNot: null } } }),
  ]);
  // publicAlumniProfile leaves out capacity and the pause switch by construction.
  return { user, completeness: view.completeness.percent, stats: { asks: received, resolved: accepted }, student: null, alumnus: publicAlumniProfile(view) };
}

/* -------------------------------- settings ------------------------------- */

export async function getSettings(admin: SessionUser) {
  assertAdmin(admin);
  const institute = await getInstitute(admin.instituteId);
  return {
    name: institute.name,
    joinCode: institute.joinCode,
    allowedEmailDomains: parseList(institute.allowedEmailDomains),
    requireApproval: institute.requireApproval,
    requestExpiryHours: institute.requestExpiryHours,
    monthlyAskLimit: institute.monthlyAskLimit,
    aiEnabled: institute.aiEnabled,
  };
}

export async function updateSettings(admin: SessionUser, input: SettingsInput) {
  assertAdmin(admin);
  const before = await getSettings(admin);
  await db.institute.update({
    where: { id: admin.instituteId },
    data: {
      name: input.name,
      allowedEmailDomains: toList(input.allowedEmailDomains),
      requireApproval: input.requireApproval,
      requestExpiryHours: input.requestExpiryHours,
      monthlyAskLimit: input.monthlyAskLimit,
      aiEnabled: input.aiEnabled,
    },
  });
  const after = await getSettings(admin);
  const changed = (Object.keys(after) as Array<keyof typeof after>).filter((key) => key !== "joinCode" && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: "institute.settings.updated", entity: "institute", entityId: admin.instituteId, payload: { changed } });
  return after;
}

/** A new code stops the old one working straight away. Existing members are not affected. */
export async function rotateJoinCode(admin: SessionUser) {
  assertAdmin(admin);
  const joinCode = await generateJoinCode();
  await db.institute.update({ where: { id: admin.instituteId }, data: { joinCode } });
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: "institute.code.rotated", entity: "institute", entityId: admin.instituteId });
  return joinCode;
}
