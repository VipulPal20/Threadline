import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { assertNotLimited, recordFailure } from "../auth/rate-limit";
import { conflict, forbidden, notFound } from "../errors";
import { recordEvent } from "./audit";
import { notify } from "./notifications";

const MESSAGE_WINDOW_MS = 60_000;
const MESSAGES_PER_WINDOW = 30;
const MAX_MESSAGES_RETURNED = 300;

function assertParticipantRole(user: SessionUser) {
  if (user.role !== "STUDENT" && user.role !== "ALUMNI") throw forbidden();
}

/** The conversation, but only if the caller is the student or the alumnus on it (and in the same institute). */
async function loadForParticipant(user: SessionUser, conversationId: string) {
  assertParticipantRole(user);
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      introRequest: { OR: [{ studentId: user.id }, { alumniId: user.id }], ask: { instituteId: user.instituteId } },
    },
    include: {
      introRequest: {
        include: {
          ask: true,
          student: { include: { studentProfile: true } },
          alumni: { include: { alumniProfile: true } },
        },
      },
    },
  });
  if (!conversation) throw notFound("Conversation not found.");
  return { conversation, request: conversation.introRequest, iAmStudent: conversation.introRequest.studentId === user.id };
}

type Loaded = Awaited<ReturnType<typeof loadForParticipant>>;

function messageView(message: { id: string; senderId: string; body: string; aiAssisted: boolean; createdAt: Date; readAt: Date | null }, userId: string) {
  const mine = message.senderId === userId;
  return {
    id: message.id,
    mine,
    body: message.body,
    aiAssisted: message.aiAssisted,
    createdAt: message.createdAt.toISOString(),
    // Read receipts are shown only on your own messages.
    readAt: mine ? message.readAt?.toISOString() ?? null : null,
  };
}

export type ChatMessage = ReturnType<typeof messageView>;

/** Marks the other person's messages as read, then returns the thread (latest 300, oldest first). */
export async function fetchMessages(user: SessionUser, conversationId: string) {
  const { conversation } = await loadForParticipant(user, conversationId);
  await db.message.updateMany({ where: { conversationId, senderId: { not: user.id }, readAt: null }, data: { readAt: new Date() } });
  const rows = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: MAX_MESSAGES_RETURNED });
  return {
    status: conversation.status,
    canSend: conversation.status === "ACTIVE",
    messages: rows.reverse().map((row) => messageView(row, user.id)),
  };
}

export async function sendMessage(user: SessionUser, conversationId: string, input: { body: string; aiAssisted: boolean }) {
  const { conversation, request } = await loadForParticipant(user, conversationId);
  if (conversation.status !== "ACTIVE") throw conflict("This conversation has ended.");

  const key = `msg:${user.id}`;
  assertNotLimited(key, MESSAGES_PER_WINDOW);
  recordFailure(key, MESSAGE_WINDOW_MS);

  const message = await db.message.create({ data: { conversationId, senderId: user.id, body: input.body, aiAssisted: input.aiAssisted } });
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });

  // One unread "new message" notification per conversation, so a busy chat does not flood the bell.
  const recipientId = request.studentId === user.id ? request.alumniId : request.studentId;
  const alreadyNotified = await db.notification.count({ where: { userId: recipientId, kind: "message_received", readAt: null, payload: { contains: conversationId } } });
  if (!alreadyNotified) await notify(recipientId, "message_received", { conversationId, askTitle: request.ask.title });
  // Audit events carry no message text, only that a message was sent.
  await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "message.sent", entity: "conversation", entityId: conversationId, payload: { aiAssisted: input.aiAssisted } });
  return messageView(message, user.id);
}

function otherPerson(loaded: Loaded) {
  const { request, iAmStudent, conversation } = loaded;
  const revealed = request.state === "ACCEPTED" && conversation.status === "ACTIVE";
  if (iAmStudent) {
    const alumnus = request.alumni;
    const profile = alumnus.alumniProfile;
    return {
      id: alumnus.id,
      name: alumnus.name,
      role: "ALUMNI" as const,
      headline: profile?.headline ?? null,
      currentTitle: profile?.currentTitle ?? null,
      currentCompany: profile?.currentCompany ?? null,
      department: profile?.department ?? null,
      graduationYear: profile?.graduationYear ?? null,
      city: profile?.city ?? null,
      linkedinUrl: revealed ? profile?.linkedinUrl ?? null : null,
      resumeId: null as string | null,
    };
  }
  const student = request.student;
  const profile = student.studentProfile;
  return {
    id: student.id,
    name: student.name,
    role: "STUDENT" as const,
    headline: profile?.headline ?? null,
    currentTitle: null,
    currentCompany: null,
    department: profile?.department ?? null,
    graduationYear: profile?.graduationYear ?? null,
    city: profile?.city ?? null,
    linkedinUrl: revealed ? profile?.linkedinUrl ?? null : null,
    resumeId: profile?.resumeId ?? null,
  };
}

/** Everything the conversation page needs. Email and phone are never shown; people talk in the chat. */
export async function getConversation(user: SessionUser, conversationId: string) {
  const loaded = await loadForParticipant(user, conversationId);
  const { conversation, request, iAmStudent } = loaded;
  const thread = await fetchMessages(user, conversationId);
  const ask = request.ask;
  return {
    id: conversation.id,
    status: conversation.status,
    iAmStudent,
    other: otherPerson(loaded),
    ask: {
      id: ask.id,
      title: ask.title,
      category: ask.category,
      description: ask.description,
      deadline: ask.deadline ? ask.deadline.toISOString().slice(0, 10) : null,
      status: ask.status,
      resolvedAt: ask.resolvedAt?.toISOString() ?? null,
      rating: iAmStudent ? ask.rating : null,
    },
    messages: thread.messages,
    canSend: thread.canSend,
  };
}

export type ConversationView = Awaited<ReturnType<typeof getConversation>>;

export async function listConversations(user: SessionUser) {
  assertParticipantRole(user);
  const rows = await db.conversation.findMany({
    where: { introRequest: { OR: [{ studentId: user.id }, { alumniId: user.id }], ask: { instituteId: user.instituteId } } },
    orderBy: { lastMessageAt: "desc" },
    include: {
      introRequest: { include: { ask: { select: { id: true, title: true, status: true } }, student: { select: { id: true, name: true } }, alumni: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const unread = await db.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: rows.map((row) => row.id) }, senderId: { not: user.id }, readAt: null },
    _count: { _all: true },
  });
  const unreadBy = new Map(unread.map((entry) => [entry.conversationId, entry._count._all]));
  return rows.map((row) => {
    const iAmStudent = row.introRequest.studentId === user.id;
    const last = row.messages[0];
    return {
      id: row.id,
      status: row.status,
      with: iAmStudent ? row.introRequest.alumni.name : row.introRequest.student.name,
      ask: row.introRequest.ask,
      lastMessage: last ? { mine: last.senderId === user.id, snippet: last.body.slice(0, 120), at: last.createdAt.toISOString() } : null,
      unread: unreadBy.get(row.id) ?? 0,
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

/** Ends a conversation without resolving the ask: the ask goes back to open so the student can pick someone else. */
export async function endConversation(user: SessionUser, conversationId: string) {
  const { conversation, request, iAmStudent } = await loadForParticipant(user, conversationId);
  if (conversation.status !== "ACTIVE") throw conflict("This conversation has already ended.");
  const now = new Date();
  await db.$transaction(async (tx) => {
    const claimed = await tx.conversation.updateMany({ where: { id: conversationId, status: "ACTIVE" }, data: { status: "CLOSED" } });
    if (claimed.count !== 1) throw conflict("This conversation has already ended.");
    await tx.introRequest.update({ where: { id: request.id }, data: { state: "CLOSED", closedAt: now } });
    if (request.ask.status === "IN_PROGRESS") await tx.ask.update({ where: { id: request.askId }, data: { status: "OPEN" } });
  });
  const otherId = iAmStudent ? request.alumniId : request.studentId;
  await notify(otherId, "conversation_ended", { askId: request.askId, requestId: request.id, askTitle: request.ask.title, conversationId });
  await recordEvent({
    instituteId: user.instituteId,
    actorId: user.id,
    kind: "conversation.closed",
    entity: "conversation",
    entityId: conversationId,
    payload: { reason: iAmStudent ? "ended_by_student" : "ended_by_alumnus" },
  });
}

/** The student closes the loop: records the outcome and rating, ends the conversation and frees the alumnus. */
export async function resolveAsk(student: SessionUser, askId: string, input: { rating: number; note: string | null }) {
  if (student.role !== "STUDENT") throw forbidden();
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId } });
  if (!ask) throw notFound("Ask not found.");
  if (ask.status === "RESOLVED") throw conflict("This ask is already resolved.");
  if (ask.status !== "IN_PROGRESS") throw conflict("You can mark an ask resolved once an alumnus has accepted it.");

  const request = await db.introRequest.findFirst({ where: { askId, state: "ACCEPTED" }, include: { conversation: true } });
  if (!request) throw conflict("There is no accepted request on this ask.");

  const now = new Date();
  await db.$transaction(async (tx) => {
    const claimed = await tx.ask.updateMany({ where: { id: askId, status: "IN_PROGRESS" }, data: { status: "RESOLVED", resolvedAt: now, rating: input.rating, resolutionNote: input.note } });
    if (claimed.count !== 1) throw conflict("This ask has already been closed.");
    await tx.introRequest.update({ where: { id: request.id }, data: { state: "CLOSED", closedAt: now } });
    if (request.conversation) await tx.conversation.update({ where: { id: request.conversation.id }, data: { status: "CLOSED" } });
  });
  await notify(request.alumniId, "ask_resolved", { askId, requestId: request.id, askTitle: ask.title, conversationId: request.conversation?.id });
  const hours = Math.round(((now.getTime() - ask.createdAt.getTime()) / 3_600_000) * 10) / 10;
  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "ask.resolved", entity: "ask", entityId: askId, payload: { rating: input.rating, hoursToResolve: hours } });
  await recordEvent({ instituteId: student.instituteId, actorId: student.id, kind: "conversation.closed", entity: "conversation", entityId: request.conversation?.id, payload: { reason: "resolved" } });
}
