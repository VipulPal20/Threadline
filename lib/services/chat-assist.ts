import { db } from "../db";
import { assist, type AssistContext, type AssistTask } from "../ai/assist";
import type { SessionUser } from "../auth/types";
import { badRequest, conflict, forbidden, notFound } from "../errors";

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** Builds the context for the caller (last 20 messages) and asks for a suggestion, polish or summary. Nothing is sent or stored. */
export async function assistInConversation(user: SessionUser, conversationId: string, task: AssistTask, text?: string) {
  if (user.role !== "STUDENT" && user.role !== "ALUMNI") throw forbidden();
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, introRequest: { OR: [{ studentId: user.id }, { alumniId: user.id }], ask: { instituteId: user.instituteId } } },
    include: { introRequest: { include: { ask: true, student: { select: { id: true, name: true } }, alumni: { select: { id: true, name: true } } } } },
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (task !== "summarise" && conversation.status !== "ACTIVE") throw conflict("This conversation has ended.");
  if (task === "improve" && (text?.trim().length ?? 0) < 5) throw badRequest("Write your message first, then ask for it to be improved.");

  const { introRequest } = conversation;
  const iAmStudent = introRequest.studentId === user.id;
  const me = iAmStudent ? introRequest.student : introRequest.alumni;
  const other = iAmStudent ? introRequest.alumni : introRequest.student;
  const recent = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 20, select: { senderId: true, body: true } });

  const context: AssistContext = {
    ask: { title: introRequest.ask.title, category: introRequest.ask.category, description: introRequest.ask.description },
    me: { role: iAmStudent ? "student" : "alumnus", firstName: firstName(me.name) },
    other: { role: iAmStudent ? "alumnus" : "student", firstName: firstName(other.name) },
    messages: recent.reverse().map((message) => ({ from: message.senderId === user.id ? "me" : "them", text: message.body })),
    draft: text?.trim(),
  };
  return assist(user, task, context);
}
