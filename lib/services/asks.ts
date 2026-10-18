import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { LIMITS } from "../domain/constants";
import { conflict, forbidden, notFound } from "../errors";
import { normalizeSkills } from "../matching/skills-normalize";
import type { AskInput } from "../validation/ask";
import { recordEvent } from "./audit";
import { notify } from "./notifications";
import { computeRanking, snapshotIfChanged } from "./matching";

function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function assertStudent(user: SessionUser) {
  if (user.role !== "STUDENT") throw forbidden();
}

/** Asks left this calendar month. Every ask counts once posted, even if later cancelled. */
export async function askQuota(student: SessionUser, now = new Date()) {
  assertStudent(student);
  const institute = await db.institute.findUniqueOrThrow({ where: { id: student.instituteId }, select: { monthlyAskLimit: true } });
  const used = await db.ask.count({ where: { studentId: student.id, createdAt: { gte: startOfMonthUtc(now) } } });
  const limit = institute.monthlyAskLimit || LIMITS.defaultMonthlyAskLimit;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** Marks asks whose deadline has passed as EXPIRED. Called lazily whenever asks are read. */
export async function expireAsks(instituteId: string, now = new Date()): Promise<number> {
  // Only asks nobody has accepted: once someone is helping, the deadline no longer ends the ask.
  const due = await db.ask.findMany({
    where: { instituteId, status: "OPEN", deadline: { lt: startOfTodayUtc(now) } },
    select: { id: true, title: true },
  });
  for (const ask of due) {
    const claimed = await db.ask.updateMany({ where: { id: ask.id, status: "OPEN" }, data: { status: "EXPIRED" } });
    if (claimed.count !== 1) continue;
    const pending = await db.introRequest.findMany({ where: { askId: ask.id, state: "PENDING" } });
    await db.introRequest.updateMany({ where: { id: { in: pending.map((request) => request.id) } }, data: { state: "EXPIRED", closedAt: now } });
    for (const request of pending) await notify(request.alumniId, "request_expired", { askId: ask.id, requestId: request.id, askTitle: ask.title });
    await recordEvent({ instituteId, actorId: null, kind: "ask.expired", entity: "ask", entityId: ask.id });
  }
  return due.length;
}

export async function createAsk(student: SessionUser, input: AskInput) {
  assertStudent(student);
  const institute = await db.institute.findUniqueOrThrow({ where: { id: student.instituteId }, select: { monthlyAskLimit: true } });
  const limit = institute.monthlyAskLimit || LIMITS.defaultMonthlyAskLimit;

  const skillImportance = new Map<string, "MUST" | "NICE">();
  for (const skill of input.skills) {
    const [name] = normalizeSkills([skill.name]);
    if (name && !skillImportance.has(name)) skillImportance.set(name, skill.importance);
  }

  const ask = await db.$transaction(async (tx) => {
    // Counted inside the same transaction as the insert, so two quick posts cannot both squeeze under the limit.
    const used = await tx.ask.count({ where: { studentId: student.id, createdAt: { gte: startOfMonthUtc() } } });
    if (used >= limit) throw conflict(`You have used all ${limit} asks for this month. Your allowance resets next month.`);
    const created = await tx.ask.create({
      data: {
        instituteId: student.instituteId,
        studentId: student.id,
        category: input.category,
        title: input.title,
        description: input.description,
        domain: input.domain,
        targetRole: input.targetRole,
        targetCompany: input.targetCompany,
        location: input.location,
        workMode: input.workMode,
        deadline: input.deadline ? new Date(`${input.deadline}T00:00:00Z`) : null,
        urgency: input.urgency,
      },
    });
    for (const [name, importance] of skillImportance) {
      const skill = await tx.skill.upsert({ where: { name }, create: { name }, update: {} });
      await tx.askSkill.create({ data: { askId: created.id, skillId: skill.id, importance } });
    }
    return created;
  });

  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "ask.created", entity: "ask", entityId: ask.id, payload: { category: ask.category } });

  // Save what the student is about to be shown, so admins can later audit it.
  const result = await computeRanking(ask);
  await snapshotIfChanged(ask.id, result);
  await recordEvent({
    instituteId: student.instituteId,
    actorId: student.id,
    kind: "ask.matched",
    entity: "ask",
    entityId: ask.id,
    payload: { eligible: result.eligibleCount, shown: result.matches.length },
  });
  return ask;
}

const askInclude = { skills: { include: { skill: true } } } as const;

function toAskView(ask: Awaited<ReturnType<typeof db.ask.findFirstOrThrow<{ include: typeof askInclude }>>>) {
  return {
    id: ask.id,
    category: ask.category,
    title: ask.title,
    description: ask.description,
    domain: ask.domain,
    targetRole: ask.targetRole,
    targetCompany: ask.targetCompany,
    location: ask.location,
    workMode: ask.workMode,
    deadline: ask.deadline ? ask.deadline.toISOString().slice(0, 10) : null,
    urgency: ask.urgency,
    status: ask.status,
    createdAt: ask.createdAt,
    resolvedAt: ask.resolvedAt,
    rating: ask.rating,
    resolutionNote: ask.resolutionNote,
    skills: ask.skills.map((entry) => ({ name: entry.skill.name, importance: entry.importance })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type AskView = ReturnType<typeof toAskView>;

export async function listAsks(student: SessionUser) {
  assertStudent(student);
  await expireAsks(student.instituteId);
  const asks = await db.ask.findMany({ where: { studentId: student.id }, include: askInclude, orderBy: { createdAt: "desc" } });
  return asks.map(toAskView);
}

export async function getOwnAsk(student: SessionUser, askId: string) {
  assertStudent(student);
  await expireAsks(student.instituteId);
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId }, include: askInclude });
  if (!ask) throw notFound("Ask not found.");
  return toAskView(ask);
}

export async function cancelAsk(student: SessionUser, askId: string) {
  assertStudent(student);
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId } });
  if (!ask) throw notFound("Ask not found.");
  if (!["OPEN", "IN_PROGRESS"].includes(ask.status)) throw conflict("This ask is already closed.");
  const now = new Date();
  // Cancelling ends everything tied to the ask, so no alumnus keeps a place held for it.
  const released = await db.$transaction(async (tx) => {
    const claimed = await tx.ask.updateMany({ where: { id: ask.id, status: { in: ["OPEN", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    if (claimed.count !== 1) throw conflict("This ask is already closed.");
    const live = await tx.introRequest.findMany({ where: { askId: ask.id, state: { in: ["PENDING", "ACCEPTED"] } }, include: { conversation: { select: { id: true } } } });
    for (const request of live) {
      await tx.introRequest.update({ where: { id: request.id }, data: { state: request.state === "PENDING" ? "WITHDRAWN" : "CLOSED", closedAt: now } });
      if (request.conversation) await tx.conversation.update({ where: { id: request.conversation.id }, data: { status: "CLOSED" } });
    }
    return live;
  });
  for (const request of released) {
    const payload = { askId: ask.id, requestId: request.id, askTitle: ask.title, conversationId: request.conversation?.id };
    await notify(request.alumniId, request.state === "PENDING" ? "request_withdrawn" : "conversation_ended", payload);
  }
  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "ask.cancelled", entity: "ask", entityId: ask.id });
  return getOwnAsk(student, askId);
}
