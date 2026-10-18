import { db } from "../db";
import { draftRequestMessage, type DraftInput } from "../ai/draft";
import type { SessionUser } from "../auth/types";
import { LIMITS } from "../domain/constants";
import { publicStudentProfile } from "../dto/profile";
import { conflict, forbidden, notFound } from "../errors";
import { parseList } from "../json";
import { normalizeSkill } from "../matching/skills-normalize";
import { sameText } from "../matching/text";
import { recordEvent } from "./audit";
import { expireRequests } from "./expiry";
import { computeRanking, snapshotIfChanged } from "./matching";
import { notify } from "./notifications";
import { getStudentProfile } from "./profiles";

const HOUR_MS = 3_600_000;

export { expireRequests };

function assertRole(user: SessionUser, role: SessionUser["role"]) {
  if (user.role !== role) throw forbidden();
}

/** The student's own open ask, with expiry run first. */
async function loadOpenAsk(student: SessionUser, askId: string) {
  assertRole(student, "STUDENT");
  await expireRequests(student.instituteId);
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId } });
  if (!ask) throw notFound("Ask not found.");
  if (ask.status !== "OPEN") throw conflict(ask.status === "IN_PROGRESS" ? "Someone has already accepted this ask. Mark it resolved when you are done." : "This ask is closed.");
  return ask;
}

/** The alumnus must still be one of the student's current top three, otherwise the page is out of date. */
async function assertStillMatched(ask: { id: string; studentId: string; instituteId: string }, alumniId: string) {
  const ranking = await computeRanking(ask);
  if (!ranking.matches.some((match) => match.alumniId === alumniId)) {
    throw conflict("This alumnus is no longer available. Reload your matches to see who is.");
  }
  return ranking;
}

async function sharedFactsFor(askId: string, studentId: string, alumniId: string): Promise<string[]> {
  const [ask, student, alumnus] = await Promise.all([
    db.ask.findUniqueOrThrow({ where: { id: askId }, include: { skills: { include: { skill: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: studentId }, include: { studentProfile: true } }),
    db.user.findUniqueOrThrow({ where: { id: alumniId }, include: { alumniProfile: true, skills: { include: { skill: true } } } }),
  ]);
  const alumniSkills = new Set(alumnus.skills.map((row) => normalizeSkill(row.skill.name)));
  const facts = ask.skills.map((row) => row.skill.name).filter((name) => alumniSkills.has(normalizeSkill(name))).slice(0, 2);
  const profile = alumnus.alumniProfile;
  if (profile?.currentCompany && sameText(profile.currentCompany, ask.targetCompany)) facts.push(profile.currentCompany);
  if (profile?.department && sameText(profile.department, student.studentProfile?.department)) facts.push(profile.department);
  return facts;
}

/** Builds an editable draft for one of the student's current matches. Nothing is stored. */
export async function draftRequest(student: SessionUser, askId: string, alumniId: string) {
  const ask = await loadOpenAsk(student, askId);
  await assertStillMatched(ask, alumniId);

  const [studentRow, alumnusRow, institute, sharedFacts] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: student.id }, include: { studentProfile: true } }),
    db.user.findUniqueOrThrow({ where: { id: alumniId }, include: { alumniProfile: true } }),
    db.institute.findUniqueOrThrow({ where: { id: student.instituteId }, select: { name: true } }),
    sharedFactsFor(ask.id, student.id, alumniId),
  ]);
  const input: DraftInput = {
    ask: {
      title: ask.title,
      category: ask.category,
      description: ask.description,
      targetRole: ask.targetRole,
      targetCompany: ask.targetCompany,
      deadline: ask.deadline ? ask.deadline.toISOString().slice(0, 10) : null,
    },
    student: {
      firstName: studentRow.name.split(/\s+/)[0] ?? studentRow.name,
      department: studentRow.studentProfile?.department ?? null,
      degree: studentRow.studentProfile?.degree ?? null,
      graduationYear: studentRow.studentProfile?.graduationYear ?? null,
      headline: studentRow.studentProfile?.headline ?? null,
      instituteName: institute.name,
    },
    alumnus: {
      firstName: alumnusRow.name.split(/\s+/)[0] ?? alumnusRow.name,
      currentTitle: alumnusRow.alumniProfile?.currentTitle ?? null,
      currentCompany: alumnusRow.alumniProfile?.currentCompany ?? null,
    },
    sharedFacts,
  };
  return draftRequestMessage(student, input);
}

/** Sends a request to one of the student's current top matches. At most two can be pending per ask. */
export async function sendRequest(student: SessionUser, input: { askId: string; alumniId: string; message: string }) {
  const ask = await loadOpenAsk(student, input.askId);
  const pending = await db.introRequest.count({ where: { askId: ask.id, state: "PENDING" } });
  if (pending >= LIMITS.maxPendingPerAsk) {
    throw conflict(`You already have ${LIMITS.maxPendingPerAsk} requests waiting for an answer on this ask. Wait for a reply, or withdraw one.`);
  }
  const ranking = await assertStillMatched(ask, input.alumniId);
  const snapshots = await snapshotIfChanged(ask.id, ranking);

  const institute = await db.institute.findUniqueOrThrow({ where: { id: student.instituteId }, select: { requestExpiryHours: true } });
  const byHours = Date.now() + institute.requestExpiryHours * HOUR_MS;
  const byDeadline = ask.deadline ? ask.deadline.getTime() + 24 * HOUR_MS - 1 : Number.POSITIVE_INFINITY;
  const request = await db.$transaction(async (tx) => {
    // Re-checked inside the transaction so two quick clicks cannot go past the limit or reopen a closed ask.
    const stillOpen = await tx.ask.count({ where: { id: ask.id, status: "OPEN" } });
    if (!stillOpen) throw conflict("This ask is no longer open.");
    if ((await tx.introRequest.count({ where: { askId: ask.id, state: "PENDING" } })) >= LIMITS.maxPendingPerAsk) {
      throw conflict(`You already have ${LIMITS.maxPendingPerAsk} requests waiting for an answer on this ask. Wait for a reply, or withdraw one.`);
    }
    return tx.introRequest.create({
      data: {
        askId: ask.id,
        studentId: student.id,
        alumniId: input.alumniId,
        matchSnapshotId: snapshots.find((row) => row.alumniId === input.alumniId)?.id ?? null,
        initialMessage: input.message,
        expiresAt: new Date(Math.min(byHours, byDeadline)),
      },
    });
  });
  await notify(input.alumniId, "request_received", { askId: ask.id, requestId: request.id, askTitle: ask.title });
  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "request.sent", entity: "request", entityId: request.id, payload: { askId: ask.id } });
  return request.id;
}

async function ownRequestAsAlumnus(alumnus: SessionUser, requestId: string) {
  assertRole(alumnus, "ALUMNI");
  await expireRequests(alumnus.instituteId);
  const request = await db.introRequest.findFirst({
    where: { id: requestId, alumniId: alumnus.id, ask: { instituteId: alumnus.instituteId } },
    include: { ask: true },
  });
  if (!request) throw notFound("Request not found.");
  return request;
}

export async function acceptRequest(alumnus: SessionUser, requestId: string) {
  const request = await ownRequestAsAlumnus(alumnus, requestId);
  if (request.state !== "PENDING") throw conflict("This request is no longer waiting for an answer.");
  if (request.ask.status !== "OPEN") throw conflict("The student has already moved on with this ask.");

  const active = await db.introRequest.count({
    where: { alumniId: alumnus.id, state: "ACCEPTED", OR: [{ conversation: { is: null } }, { conversation: { status: "ACTIVE" } }] },
  });
  if (active >= LIMITS.maxActiveConversations) {
    throw conflict(`You already have ${LIMITS.maxActiveConversations} active conversations. Finish one before accepting another.`);
  }

  const now = new Date();
  const { others: siblings, conversationId } = await db.$transaction(async (tx) => {
    // Claim the request and the ask atomically: when two alumni say yes at once, exactly one wins.
    const claimedRequest = await tx.introRequest.updateMany({ where: { id: request.id, state: "PENDING" }, data: { state: "ACCEPTED", respondedAt: now } });
    if (claimedRequest.count !== 1) throw conflict("This request is no longer waiting for an answer.");
    const claimedAsk = await tx.ask.updateMany({ where: { id: request.askId, status: "OPEN" }, data: { status: "IN_PROGRESS" } });
    if (claimedAsk.count !== 1) throw conflict("The student has already moved on with this ask.");
    const conversation = await tx.conversation.create({ data: { introRequestId: request.id, lastMessageAt: now } });
    // The student's message becomes the first message of the conversation.
    await tx.message.create({ data: { conversationId: conversation.id, senderId: request.studentId, body: request.initialMessage, createdAt: request.createdAt } });
    // First yes wins: any other pending request for this ask is withdrawn.
    const others = await tx.introRequest.findMany({ where: { askId: request.askId, state: "PENDING", id: { not: request.id } } });
    await tx.introRequest.updateMany({ where: { id: { in: others.map((other) => other.id) } }, data: { state: "WITHDRAWN", closedAt: now } });
    return { others, conversationId: conversation.id };
  });

  const payload = { askId: request.askId, requestId: request.id, askTitle: request.ask.title, conversationId };
  await notify(request.studentId, "request_accepted", payload);
  for (const other of siblings) await notify(other.alumniId, "request_withdrawn", { askId: request.askId, requestId: other.id, askTitle: request.ask.title });
  await recordEvent({ instituteId: alumnus.instituteId, actorId: alumnus.id, kind: "request.accepted", entity: "request", entityId: request.id, payload: { askId: request.askId } });
  return { requestId: request.id, conversationId };
}

export async function declineRequest(alumnus: SessionUser, requestId: string, reason: string | null) {
  const request = await ownRequestAsAlumnus(alumnus, requestId);
  if (request.state !== "PENDING") throw conflict("This request is no longer waiting for an answer.");
  const claimed = await db.introRequest.updateMany({ where: { id: request.id, state: "PENDING" }, data: { state: "DECLINED", respondedAt: new Date(), closedAt: new Date(), declineReason: reason } });
  if (claimed.count !== 1) throw conflict("This request is no longer waiting for an answer.");
  // The reason is for the institute's records only; the student is told nothing beyond "can't help right now".
  await notify(request.studentId, "request_declined", { askId: request.askId, requestId: request.id, askTitle: request.ask.title });
  await recordEvent({ instituteId: alumnus.instituteId, actorId: alumnus.id, kind: "request.declined", entity: "request", entityId: request.id, payload: { askId: request.askId } });
}

export async function withdrawRequest(student: SessionUser, requestId: string) {
  assertRole(student, "STUDENT");
  await expireRequests(student.instituteId);
  const request = await db.introRequest.findFirst({ where: { id: requestId, studentId: student.id, ask: { instituteId: student.instituteId } }, include: { ask: true } });
  if (!request) throw notFound("Request not found.");
  if (request.state !== "PENDING") throw conflict("Only a request that is still waiting can be withdrawn.");
  const claimed = await db.introRequest.updateMany({ where: { id: request.id, state: "PENDING" }, data: { state: "WITHDRAWN", closedAt: new Date() } });
  if (claimed.count !== 1) throw conflict("Only a request that is still waiting can be withdrawn.");
  await notify(request.alumniId, "request_withdrawn", { askId: request.askId, requestId: request.id, askTitle: request.ask.title });
  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "request.withdrawn", entity: "request", entityId: request.id, payload: { askId: request.askId } });
}

/* ------------------------------ read models ------------------------------ */

export interface StudentRequestView {
  id: string;
  askId: string;
  state: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  message: string;
  alumnus: { id: string; name: string; currentTitle: string | null; currentCompany: string | null };
  conversationId: string | null;
}

export async function getRequestsForAsk(student: SessionUser, askId: string): Promise<StudentRequestView[]> {
  assertRole(student, "STUDENT");
  await expireRequests(student.instituteId);
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId }, select: { id: true } });
  if (!ask) throw notFound("Ask not found.");
  const rows = await db.introRequest.findMany({
    where: { askId },
    orderBy: { createdAt: "desc" },
    include: { alumni: { include: { alumniProfile: true } }, conversation: { select: { id: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    askId: row.askId,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    message: row.initialMessage,
    alumnus: { id: row.alumni.id, name: row.alumni.name, currentTitle: row.alumni.alumniProfile?.currentTitle ?? null, currentCompany: row.alumni.alumniProfile?.currentCompany ?? null },
    conversationId: row.conversation?.id ?? null,
  }));
}

export async function listRequestsForAlumnus(alumnus: SessionUser) {
  assertRole(alumnus, "ALUMNI");
  await expireRequests(alumnus.instituteId);
  const rows = await db.introRequest.findMany({
    where: { alumniId: alumnus.id, state: { not: "WITHDRAWN" } },
    orderBy: { createdAt: "desc" },
    include: { ask: { select: { id: true, title: true, category: true } }, student: { include: { studentProfile: true } }, matchSnapshot: { select: { score: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ask: row.ask,
    student: { id: row.student.id, name: row.student.name, department: row.student.studentProfile?.department ?? null, graduationYear: row.student.studentProfile?.graduationYear ?? null },
    matchPercent: row.matchSnapshot ? Math.round(row.matchSnapshot.score) : null,
  }));
}

export type AlumniRequestSummary = Awaited<ReturnType<typeof listRequestsForAlumnus>>[number];

/** Everything an alumnus needs to decide. Email and phone are never included. */
export async function getRequestForAlumnus(alumnus: SessionUser, requestId: string) {
  const request = await ownRequestAsAlumnus(alumnus, requestId);
  const [studentView, snapshot, conversation, skills] = await Promise.all([
    getStudentProfile(request.studentId),
    request.matchSnapshotId ? db.matchSnapshot.findUnique({ where: { id: request.matchSnapshotId } }) : null,
    db.conversation.findUnique({ where: { introRequestId: request.id }, select: { id: true } }),
    db.askSkill.findMany({ where: { askId: request.askId }, include: { skill: true } }),
  ]);
  const resumeVisible = ["PENDING", "ACCEPTED", "CLOSED"].includes(request.state);
  return {
    id: request.id,
    state: request.state,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    message: request.initialMessage,
    ask: {
      id: request.ask.id,
      title: request.ask.title,
      category: request.ask.category,
      description: request.ask.description,
      domain: request.ask.domain,
      targetRole: request.ask.targetRole,
      targetCompany: request.ask.targetCompany,
      location: request.ask.location,
      deadline: request.ask.deadline ? request.ask.deadline.toISOString().slice(0, 10) : null,
      skills: skills.map((row) => ({ name: row.skill.name, importance: row.importance })),
    },
    student: publicStudentProfile(studentView),
    resumeId: resumeVisible ? studentView.resume?.id ?? null : null,
    match: snapshot ? { percent: Math.round(snapshot.score), reasons: parseList(snapshot.reasons) } : null,
    conversationId: conversation?.id ?? null,
  };
}

export type AlumniRequestDetail = Awaited<ReturnType<typeof getRequestForAlumnus>>;

export async function alumniDashboardCounts(alumnus: SessionUser) {
  assertRole(alumnus, "ALUMNI");
  await expireRequests(alumnus.instituteId);
  const [pending, active] = await Promise.all([
    db.introRequest.count({ where: { alumniId: alumnus.id, state: "PENDING" } }),
    db.introRequest.count({ where: { alumniId: alumnus.id, state: "ACCEPTED", OR: [{ conversation: { is: null } }, { conversation: { status: "ACTIVE" } }] } }),
  ]);
  return { pending, active };
}
