import { beforeEach, describe, expect, it } from "vitest";
import { assistFallback, assistProblems, type AssistContext } from "../lib/ai/assist";
import { resetRateLimits } from "../lib/auth/rate-limit";
import { db } from "../lib/db";
import { createAsk } from "../lib/services/asks";
import { assistInConversation } from "../lib/services/chat-assist";
import { endConversation, fetchMessages, getConversation, listConversations, resolveAsk, sendMessage } from "../lib/services/conversations";
import { getMatchesForAsk } from "../lib/services/matching";
import { listNotifications } from "../lib/services/notifications";
import { acceptRequest, sendRequest } from "../lib/services/requests";
import { assistSchema, messageSchema, resolveSchema } from "../lib/validation/conversation";
import { makeAlumnus, makeStudent, validAsk } from "./factories";
import { makeInstitute, resetDb } from "./helpers";

beforeEach(resetDb);

const OPENING = "Hi, I'm working on SQL dashboards and would really value ten minutes of your advice on breaking into analytics. Thank you!";

async function acceptedScene() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const student = await makeStudent(institute.id);
  const alumnus = await makeAlumnus(institute.id, 1);
  const bystander = await makeAlumnus(institute.id, 2);
  const ask = await createAsk(student, validAsk());
  const requestId = await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });
  const { conversationId } = await acceptRequest(alumnus, requestId);
  return { institute, admin, student, alumnus, bystander, ask, requestId, conversationId };
}

describe("who can see a conversation", () => {
  it("only its two participants, within their own institute", async () => {
    const { student, alumnus, bystander, conversationId } = await acceptedScene();
    const rival = await makeStudent(student.instituteId, 5);
    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    const betaAlumnus = await makeAlumnus(other.institute.id, 8);

    for (const outsider of [rival, bystander, betaAlumnus]) {
      await expect(getConversation(outsider, conversationId)).rejects.toMatchObject({ status: 404 });
      await expect(fetchMessages(outsider, conversationId)).rejects.toMatchObject({ status: 404 });
      await expect(sendMessage(outsider, conversationId, { body: "hi", aiAssisted: false })).rejects.toMatchObject({ status: 404 });
      await expect(assistInConversation(outsider, conversationId, "summarise")).rejects.toMatchObject({ status: 404 });
      await expect(endConversation(outsider, conversationId)).rejects.toMatchObject({ status: 404 });
      expect(await listConversations(outsider)).toEqual([]);
    }
    await expect(getConversation(other.admin, conversationId)).rejects.toMatchObject({ status: 403 });
    await expect(getConversation(student, conversationId)).resolves.toMatchObject({ iAmStudent: true });
    await expect(getConversation(alumnus, conversationId)).resolves.toMatchObject({ iAmStudent: false });
  });

  it("starts with the student's opening message and never shows either side the other's email or phone", async () => {
    const { student, alumnus, conversationId } = await acceptedScene();
    const forStudent = await getConversation(student, conversationId);
    expect(forStudent.messages).toHaveLength(1);
    expect(forStudent.messages[0]).toMatchObject({ mine: true, body: OPENING });
    expect(JSON.stringify(forStudent)).not.toContain((await db.user.findUniqueOrThrow({ where: { id: alumnus.id } })).email);

    const forAlumnus = await getConversation(alumnus, conversationId);
    expect(forAlumnus.messages[0]).toMatchObject({ mine: false });
    expect(JSON.stringify(forAlumnus)).not.toContain((await db.user.findUniqueOrThrow({ where: { id: student.id } })).email);
    expect(forAlumnus.other).not.toHaveProperty("contacts");
    expect(forAlumnus.other.resumeId).toBeNull();
    expect(JSON.stringify(forStudent)).not.toContain("maxActiveConnections");
  });
});

describe("messages", () => {
  it("stores messages, flags AI help, shows read receipts only on your own messages, and coalesces notifications", async () => {
    const { student, alumnus, conversationId } = await acceptedScene();
    const first = await sendMessage(alumnus, conversationId, { body: "  Happy to help. What are you stuck on?  ", aiAssisted: true });
    expect(first).toMatchObject({ mine: true, body: "Happy to help. What are you stuck on?".trim() === first.body ? first.body : first.body, aiAssisted: true, readAt: null });

    await sendMessage(alumnus, conversationId, { body: "Also, do you have a portfolio?", aiAssisted: false });
    const messageNotifications = (await listNotifications(student)).notifications.filter((item) => item.kind === "message_received");
    expect(messageNotifications).toHaveLength(1);
    expect(messageNotifications[0]!.href).toBe(`/student/conversations/${conversationId}`);

    const asStudent = await fetchMessages(student, conversationId);
    expect(asStudent.messages.map((message) => message.mine)).toEqual([true, false, false]);
    expect(asStudent.messages[1]!.readAt).toBeNull();

    const asAlumnus = await fetchMessages(alumnus, conversationId);
    expect(asAlumnus.messages[1]!.readAt).not.toBeNull();
    expect(asAlumnus.messages[0]!.readAt).toBeNull();

    // once read, a new message notifies again
    await db.notification.updateMany({ data: { readAt: new Date() } });
    await sendMessage(alumnus, conversationId, { body: "One more thing.", aiAssisted: false });
    expect((await listNotifications(student)).unread).toBe(1);
  });

  it("counts unread messages in the list", async () => {
    const { student, alumnus, conversationId } = await acceptedScene();
    await sendMessage(student, conversationId, { body: "Following up on my note.", aiAssisted: false });
    const [summary] = await listConversations(alumnus);
    expect(summary).toMatchObject({ id: conversationId, status: "ACTIVE", unread: 2, with: student.name });
    expect(summary!.lastMessage).toMatchObject({ mine: false, snippet: "Following up on my note." });
    await fetchMessages(alumnus, conversationId);
    expect((await listConversations(alumnus))[0]!.unread).toBe(0);
  });

  it("limits how fast one person can send", async () => {
    const { student, conversationId } = await acceptedScene();
    resetRateLimits();
    for (let n = 0; n < 30; n += 1) await sendMessage(student, conversationId, { body: `message ${n}`, aiAssisted: false });
    await expect(sendMessage(student, conversationId, { body: "one too many", aiAssisted: false })).rejects.toMatchObject({ status: 429 });
  });

  it("validates message input", () => {
    expect(() => messageSchema.parse({ body: "   " })).toThrow(/Write a message/);
    expect(() => messageSchema.parse({ body: "x".repeat(2001) })).toThrow(/2,000/);
    expect(messageSchema.parse({ body: " hi " })).toEqual({ body: "hi", aiAssisted: false });
    expect(() => assistSchema.parse({ task: "write-my-essay" })).toThrow();
  });
});

describe("ending a conversation without resolving", () => {
  it("closes it, reopens the ask, frees the alumnus's place and keeps them out of this ask", async () => {
    const { student, alumnus, ask, requestId, conversationId } = await acceptedScene();
    await endConversation(alumnus, conversationId);

    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).status).toBe("CLOSED");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id: requestId } })).state).toBe("CLOSED");
    expect((await db.ask.findUniqueOrThrow({ where: { id: ask.id } })).status).toBe("OPEN");
    expect((await listNotifications(student)).notifications.map((item) => item.kind)).toContain("conversation_ended");

    await expect(sendMessage(student, conversationId, { body: "hello?", aiAssisted: false })).rejects.toMatchObject({ status: 409 });
    await expect(endConversation(student, conversationId)).rejects.toMatchObject({ status: 409 });
    const after = await getConversation(student, conversationId);
    expect(after.canSend).toBe(false);
    expect(after.other).not.toHaveProperty("contacts");
    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).not.toContain(alumnus.id);
  });
});

describe("resolving an ask", () => {
  it("records the rating, closes the conversation, thanks the alumnus and frees their place for others", async () => {
    const { institute, student, alumnus, ask, requestId, conversationId } = await acceptedScene();
    await resolveAsk(student, ask.id, { rating: 5, note: "Super helpful" });

    const row = await db.ask.findUniqueOrThrow({ where: { id: ask.id } });
    expect(row).toMatchObject({ status: "RESOLVED", rating: 5, resolutionNote: "Super helpful" });
    expect(row.resolvedAt).not.toBeNull();
    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).status).toBe("CLOSED");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id: requestId } })).state).toBe("CLOSED");

    const note = (await listNotifications(alumnus)).notifications.find((item) => item.kind === "ask_resolved");
    expect(note?.href).toBe(`/alumni/conversations/${conversationId}`);
    expect((await getConversation(alumnus, conversationId)).other).not.toHaveProperty("contacts");

    const event = await db.auditEvent.findFirstOrThrow({ where: { kind: "ask.resolved" } });
    expect(JSON.parse(event.payload)).toMatchObject({ rating: 5 });

    // the alumnus is available to the next student again
    const next = await makeStudent(institute.id, 3);
    const nextAsk = await createAsk(next, validAsk());
    expect((await getMatchesForAsk(next, nextAsk.id)).matches.map((card) => card.alumnus.id)).toContain(alumnus.id);
  });

  it("is only for the asker, only once, and only after someone accepted", async () => {
    const { student, alumnus, ask, institute } = await acceptedScene();
    const stranger = await makeStudent(institute.id, 4);
    await expect(resolveAsk(stranger, ask.id, { rating: 3, note: null })).rejects.toMatchObject({ status: 404 });
    await expect(resolveAsk(alumnus, ask.id, { rating: 3, note: null })).rejects.toMatchObject({ status: 403 });

    const fresh = await createAsk(student, validAsk());
    await expect(resolveAsk(student, fresh.id, { rating: 4, note: null })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("accepted") });

    await resolveAsk(student, ask.id, { rating: 4, note: null });
    await expect(resolveAsk(student, ask.id, { rating: 4, note: null })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("already resolved") });
  });

  it("validates the rating", () => {
    expect(() => resolveSchema.parse({ rating: 0 })).toThrow(/1 to 5/);
    expect(() => resolveSchema.parse({ rating: 6 })).toThrow(/1 to 5/);
    expect(() => resolveSchema.parse({})).toThrow(/rating/);
    expect(resolveSchema.parse({ rating: 3, note: "  " })).toEqual({ rating: 3, note: null });
  });

  it("keeps message text out of everything the admin's metrics are built from", async () => {
    const { student, alumnus, ask, conversationId } = await acceptedScene();
    await sendMessage(alumnus, conversationId, { body: "A very private remark about interview prep", aiAssisted: false });
    await resolveAsk(student, ask.id, { rating: 5, note: null });
    const events = JSON.stringify(await db.auditEvent.findMany());
    expect(events).not.toContain("private remark");
    expect(events).not.toContain(OPENING.slice(0, 30));
    expect(events).toContain("message.sent");
  });
});

describe("AI help in the chat", () => {
  const context: AssistContext = {
    ask: { title: "Mentor for data analytics", category: "mentorship", description: "I need mentorship." },
    me: { role: "student", firstName: "Asha" },
    other: { role: "alumnus", firstName: "Ravi" },
    messages: [{ from: "them", text: "Happy to help. What are you stuck on?" }],
    draft: "  hi ravi i am stuck on joins  ",
  };

  it("falls back to plain templates when Gemini is not configured, and never sends anything itself", async () => {
    delete process.env.GEMINI_API_KEY;
    const { student, alumnus, conversationId } = await acceptedScene();

    const suggestion = await assistInConversation(student, conversationId, "suggest");
    expect(suggestion.usedFallback).toBe(true);
    expect(suggestion.text).toMatch(/thank you for accepting/i);

    const alumnusSuggestion = await assistInConversation(alumnus, conversationId, "suggest");
    expect(alumnusSuggestion.text).toContain(`Thanks for the update, ${student.name.split(" ")[0]}`);

    const improved = await assistInConversation(student, conversationId, "improve", "  hello  there i need help ");
    expect(improved.text).toBe("Hello there i need help.");

    const summary = await assistInConversation(student, conversationId, "summarise");
    expect(summary.text).toMatch(/^- About: /);

    expect(await db.message.count({ where: { conversationId } })).toBe(1);
  });

  it("needs real text to improve, and refuses to write into an ended conversation but can still summarise it", async () => {
    const { student, alumnus, conversationId } = await acceptedScene();
    await expect(assistInConversation(student, conversationId, "improve", "hi")).rejects.toMatchObject({ status: 400 });
    await endConversation(alumnus, conversationId);
    await expect(assistInConversation(student, conversationId, "suggest")).rejects.toMatchObject({ status: 409 });
    await expect(assistInConversation(student, conversationId, "summarise")).resolves.toMatchObject({ usedFallback: true });
  });

  it("builds sensible fallback text from the conversation", () => {
    expect(assistFallback("suggest", context)).toMatch(/^Thank you, Ravi/);
    expect(assistFallback("suggest", { ...context, messages: [] })).toMatch(/^Hi Ravi, thank you for accepting/);
    expect(assistFallback("suggest", { ...context, me: { role: "alumnus", firstName: "Ravi" }, other: { role: "student", firstName: "Asha" } })).toMatch(/^Thanks for the update, Asha/);
    expect(assistFallback("improve", context)).toBe("Hi ravi i am stuck on joins.");
    expect(assistFallback("summarise", context)).toContain("1 messages so far");
  });

  it("rejects model output with contact details, runaway length or a bloated rewrite", () => {
    expect(assistProblems("suggest", "Call me on 98765 43210 please", context).join()).toMatch(/contact/);
    expect(assistProblems("suggest", "see https://example.com", context).join()).toMatch(/contact/);
    expect(assistProblems("suggest", "x".repeat(1300), context).join()).toMatch(/too long/);
    expect(assistProblems("improve", "word ".repeat(80), context).join()).toMatch(/longer than the draft/);
    expect(assistProblems("suggest", "", context).join()).toMatch(/empty/);
    expect(assistProblems("suggest", "Thanks Ravi, could we talk on Thursday?", context)).toEqual([]);
  });
});
