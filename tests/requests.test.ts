import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { draftProblems, draftRequestMessage, templateDraft, type DraftInput } from "../lib/ai/draft";
import { db } from "../lib/db";
import { toNotificationView } from "../lib/dto/notification";
import { createAsk } from "../lib/services/asks";
import { expireRequests } from "../lib/services/expiry";
import { getMatchesForAsk } from "../lib/services/matching";
import { listNotifications, markNotificationsRead } from "../lib/services/notifications";
import {
  acceptRequest,
  alumniDashboardCounts,
  declineRequest,
  draftRequest,
  getRequestForAlumnus,
  getRequestsForAsk,
  listRequestsForAlumnus,
  sendRequest,
  withdrawRequest,
} from "../lib/services/requests";
import { getResumeFile, resumeDir } from "../lib/services/resumes";
import { requestMessageSchema } from "../lib/validation/request";
import { makeAlumnus, makeStudent, validAsk } from "./factories";
import { makeInstitute, resetDb } from "./helpers";

beforeEach(resetDb);

const MESSAGE = "Hi, I'm a final-year student working on SQL dashboards and I would really value ten minutes of your advice on breaking into analytics. Thank you!";

async function scene() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const student = await makeStudent(institute.id);
  const a1 = await makeAlumnus(institute.id, 1);
  const a2 = await makeAlumnus(institute.id, 2);
  const a3 = await makeAlumnus(institute.id, 3);
  const ask = await createAsk(student, validAsk());
  return { institute, admin, student, a1, a2, a3, ask };
}

describe("draft message", () => {
  const input: DraftInput = {
    ask: { title: "Mentor for data analytics", category: "mentorship", description: "I need mentorship on data analytics and want to build a portfolio.", targetRole: "Data Analyst", targetCompany: null, deadline: "2999-12-01" },
    student: { firstName: "Asha", department: "Computer Science", degree: "B.Tech", graduationYear: 2026, headline: null, instituteName: "Alpha Institute" },
    alumnus: { firstName: "Ravi", currentTitle: "Data Analyst", currentCompany: "Northstar Labs" },
    sharedFacts: ["sql", "Computer Science"],
  };

  it("builds a template that passes its own validator", () => {
    const text = templateDraft(input);
    expect(draftProblems(text, input)).toEqual([]);
    expect(text).toContain("Hi Ravi");
    expect(text).toContain("2999-12-01");
    expect(text.trim().endsWith("Asha")).toBe(true);
  });

  it("rejects drafts that leak contacts, invent numbers, skip the deadline or ignore shared facts", () => {
    const base = templateDraft(input);
    expect(draftProblems(`${base} Reach me at asha@x.com`, input).join()).toMatch(/contact/);
    expect(draftProblems(`${base} I have 7 years of experience.`, input).join()).toMatch(/number not in the inputs \(7\)/);
    expect(draftProblems(base.replace("2999-12-01", "soon"), input).join()).toMatch(/deadline/);
    expect(draftProblems("Hi Ravi, could you help me? Thanks, Asha", input).join()).toMatch(/words/);
    expect(draftProblems(base.replace(/sql/gi, "x").replace(/Computer Science/g, "y"), input).join()).toMatch(/shared facts/);
  });

  it("falls back to the template when Gemini is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await draftRequestMessage({ id: "u", instituteId: "i" }, input);
    expect(result.usedFallback).toBe(true);
    expect(result.message).toBe(templateDraft(input));
  });

  it("produces a draft only for a current top-three match of the student's own open ask", async () => {
    const { student, a1, ask, institute } = await scene();
    const { message, usedFallback } = await draftRequest(student, ask.id, a1.id);
    expect(usedFallback).toBe(true);
    expect(message).toContain("Hi Alumnus,");
    expect(message).not.toMatch(/@|\+91/);

    const outsider = await makeAlumnus(institute.id, 9, { acceptingRequests: false });
    await expect(draftRequest(student, ask.id, outsider.id)).rejects.toMatchObject({ status: 409 });
    const rival = await makeStudent(institute.id, 2);
    await expect(draftRequest(rival, ask.id, a1.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("message validation", () => {
  it("blocks contact details and too-short messages", () => {
    expect(() => requestMessageSchema.parse("short")).toThrow(/few sentences/);
    expect(() => requestMessageSchema.parse(`${MESSAGE} Email me at kid@example.com`)).toThrow(/emails, phone numbers or links/);
    expect(() => requestMessageSchema.parse(`${MESSAGE} Call +91 98765 43210`)).toThrow(/emails, phone numbers or links/);
    expect(() => requestMessageSchema.parse(`${MESSAGE} See https://example.com`)).toThrow(/emails, phone numbers or links/);
    expect(requestMessageSchema.parse(MESSAGE)).toBe(MESSAGE);
  });
});

describe("sending requests", () => {
  it("creates a pending request, counts it against the alumnus's load, and notifies them", async () => {
    const { student, a1, ask } = await scene();
    const id = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    const row = await db.introRequest.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("PENDING");
    expect(row.matchSnapshotId).not.toBeNull();
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 70 * 3_600_000);

    const inbox = await listNotifications(a1);
    expect(inbox.unread).toBe(1);
    expect(inbox.notifications[0]).toMatchObject({ kind: "request_received", href: `/alumni/requests/${id}` });

    const after = await getMatchesForAsk(student, ask.id);
    expect(after.matches.map((card) => card.alumnus.id)).not.toContain(a1.id);
  });

  it("allows two pending requests per ask but not a third, and frees a slot on withdraw", async () => {
    const { student, a1, a2, a3, ask } = await scene();
    const first = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await sendRequest(student, { askId: ask.id, alumniId: a2.id, message: MESSAGE });
    await expect(sendRequest(student, { askId: ask.id, alumniId: a3.id, message: MESSAGE })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("2 requests") });
    await withdrawRequest(student, first);
    await expect(sendRequest(student, { askId: ask.id, alumniId: a3.id, message: MESSAGE })).resolves.toBeTruthy();
  });

  it("rejects a repeat request, an unavailable alumnus and someone else's ask", async () => {
    const { student, a1, ask, institute } = await scene();
    await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await expect(sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE })).rejects.toMatchObject({ status: 409 });
    const stranger = await makeStudent(institute.id, 2);
    await expect(sendRequest(stranger, { askId: ask.id, alumniId: a1.id, message: MESSAGE })).rejects.toMatchObject({ status: 404 });
  });

  it("only lets students send requests", async () => {
    const { a1, a2, ask } = await scene();
    await expect(sendRequest(a1, { askId: ask.id, alumniId: a2.id, message: MESSAGE })).rejects.toMatchObject({ status: 403 });
  });
});

describe("alumnus decisions", () => {
  it("accepting opens a conversation seeded with the student's message, moves the ask on, reveals contacts and withdraws the other pending request", async () => {
    const { student, a1, a2, ask } = await scene();
    const first = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    const second = await sendRequest(student, { askId: ask.id, alumniId: a2.id, message: "Hello, I would love some guidance on data analytics and how to build a portfolio. Thanks a lot." });

    const before = await getRequestForAlumnus(a1, first);
    expect(before).not.toHaveProperty("contacts");
    expect(JSON.stringify(before)).not.toContain("student1-");

    await acceptRequest(a1, first);
    const conversation = await db.conversation.findUniqueOrThrow({ where: { introRequestId: first }, include: { messages: true } });
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0]!.body).toBe(MESSAGE);
    expect(conversation.messages[0]!.senderId).toBe(student.id);
    expect((await db.ask.findUniqueOrThrow({ where: { id: ask.id } })).status).toBe("IN_PROGRESS");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id: second } })).state).toBe("WITHDRAWN");

    const after = await getRequestForAlumnus(a1, first);
    expect(after).not.toHaveProperty("contacts");
    expect(JSON.stringify(after)).not.toContain("@x.test");
    const studentView = await getRequestsForAsk(student, ask.id);
    expect(JSON.stringify(studentView)).not.toContain((await db.user.findUniqueOrThrow({ where: { id: a1.id } })).email);

    expect((await listNotifications(student)).notifications.map((item) => item.kind)).toContain("request_accepted");
    expect((await listNotifications(a2)).notifications.map((item) => item.kind)).toContain("request_withdrawn");
    await expect(sendRequest(student, { askId: ask.id, alumniId: a2.id, message: MESSAGE })).rejects.toMatchObject({ status: 409 });
    await expect(acceptRequest(a1, first)).rejects.toMatchObject({ status: 409 });
  });

  it("declining tells the student nothing about the reason, frees the alumnus's slot and keeps them out of this ask", async () => {
    const { student, a1, ask } = await scene();
    const id = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await declineRequest(a1, id, "too busy this month");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id } })).declineReason).toBe("too busy this month");

    const views = JSON.stringify(await getRequestsForAsk(student, ask.id));
    expect(views).not.toContain("too busy");
    expect(views).toContain("DECLINED");
    expect((await listNotifications(student)).notifications.map((item) => item.kind)).toContain("request_declined");
    expect(JSON.stringify(await listNotifications(student))).not.toContain("too busy");

    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).not.toContain(a1.id);
    expect(await alumniDashboardCounts(a1)).toEqual({ pending: 0, active: 0 });
  });

  it("only the addressed alumnus, within the same institute, can see or decide a request", async () => {
    const { student, a1, a2, ask, institute } = await scene();
    const id = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await expect(getRequestForAlumnus(a2, id)).rejects.toMatchObject({ status: 404 });
    await expect(acceptRequest(a2, id)).rejects.toMatchObject({ status: 404 });
    await expect(declineRequest(a2, id, null)).rejects.toMatchObject({ status: 404 });
    await expect(acceptRequest(student, id)).rejects.toMatchObject({ status: 403 });
    expect(await listRequestsForAlumnus(a2)).toEqual([]);
    expect((await listRequestsForAlumnus(a1)).map((request) => request.id)).toEqual([id]);

    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    const betaAlumnus = await makeAlumnus(other.institute.id, 7);
    await expect(getRequestForAlumnus(betaAlumnus, id)).rejects.toMatchObject({ status: 404 });
    expect(institute.id).not.toBe(other.institute.id);
  });

  it("refuses to accept a fifth active conversation", async () => {
    const { student, institute, a1, ask } = await scene();
    for (let n = 0; n < 4; n += 1) {
      const peer = await makeStudent(institute.id, 20 + n);
      const peerAsk = await db.ask.create({ data: { instituteId: institute.id, studentId: peer.id, category: "mentorship", title: "Peer", description: "x".repeat(25) } });
      const accepted = await db.introRequest.create({ data: { askId: peerAsk.id, studentId: peer.id, alumniId: a1.id, state: "ACCEPTED", respondedAt: new Date(), initialMessage: "Hi", expiresAt: new Date() } });
      await db.conversation.create({ data: { introRequestId: accepted.id } });
    }
    // a1 is now hidden from rankings, so create the pending request directly.
    const pending = await db.introRequest.create({ data: { askId: ask.id, studentId: student.id, alumniId: a1.id, initialMessage: MESSAGE, expiresAt: new Date(Date.now() + 86_400_000) } });
    await expect(acceptRequest(a1, pending.id)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("4 active conversations") });
  });
});

describe("expiry and notifications", () => {
  it("expires unanswered requests, frees the alumnus and notifies both people", async () => {
    const { student, a1, ask, institute } = await scene();
    const id = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    expect(await expireRequests(institute.id)).toBe(0);
    await db.introRequest.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireRequests(institute.id)).toBe(1);
    expect((await db.introRequest.findUniqueOrThrow({ where: { id } })).state).toBe("EXPIRED");
    expect((await listNotifications(student)).notifications.map((item) => item.kind)).toContain("request_expired");
    expect((await listNotifications(a1)).notifications.map((item) => item.kind)).toContain("request_expired");
    await expect(acceptRequest(a1, id)).rejects.toMatchObject({ status: 409 });
  });

  it("scopes notifications to their owner and marks them read", async () => {
    const { student, a1, a2, ask } = await scene();
    await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    expect((await listNotifications(a2)).notifications).toEqual([]);
    const mine = await listNotifications(a1);
    await markNotificationsRead(a2, mine.notifications.map((item) => item.id));
    expect((await listNotifications(a1)).unread).toBe(1);
    await markNotificationsRead(a1);
    expect((await listNotifications(a1)).unread).toBe(0);
  });

  it("words notifications for the right audience", () => {
    const row = { id: "n", kind: "request_expired", payload: JSON.stringify({ askId: "a", requestId: "r", askTitle: "My ask" }), readAt: null, createdAt: new Date() };
    expect(toNotificationView(row, "STUDENT").href).toBe("/student/asks/a");
    expect(toNotificationView(row, "ALUMNI").href).toBe("/alumni/requests/r");
    expect(toNotificationView({ ...row, payload: "not json" }, "STUDENT").text).toContain("your ask");
  });
});

describe("résumé access for alumni", () => {
  it("lets an alumnus open a résumé only while they hold a live request from that student", async () => {
    const { student, a1, a2, ask } = await scene();
    await mkdir(resumeDir(), { recursive: true });
    await writeFile(path.join(resumeDir(), "test-cv.pdf"), "%PDF-1.4 test");
    const resume = await db.resume.create({ data: { userId: student.id, fileName: "cv.pdf", mime: "application/pdf", size: 13, storagePath: "test-cv.pdf" } });
    await expect(getResumeFile(a1, resume.id)).rejects.toMatchObject({ status: 404 });

    const id = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await expect(getResumeFile(a1, resume.id)).resolves.toMatchObject({ fileName: "cv.pdf" });
    await expect(getResumeFile(a2, resume.id)).rejects.toMatchObject({ status: 404 });
    expect(await db.auditEvent.count({ where: { kind: "resume.viewed", actorId: a1.id } })).toBe(1);

    await declineRequest(a1, id, null);
    await expect(getResumeFile(a1, resume.id)).rejects.toMatchObject({ status: 404 });
    await expect(getResumeFile(student, resume.id)).resolves.toBeTruthy();
  });
});
