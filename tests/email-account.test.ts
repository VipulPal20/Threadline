import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../lib/auth/password";
import { db } from "../lib/db";
import { testOutbox } from "../lib/email/send";
import { createAsk } from "../lib/services/asks";
import { deleteMyAccount, exportMyData, setEmailNotifications } from "../lib/services/account";
import { sendMessage } from "../lib/services/conversations";
import { createInvite } from "../lib/services/invites";
import { createResetLink } from "../lib/services/password-reset";
import { acceptRequest, sendRequest } from "../lib/services/requests";
import { applyUserAction, authenticate, registerMember } from "../lib/services/users";
import { registerInstituteSchema, registerMemberSchema, inviteAcceptSchema } from "../lib/validation/auth";
import { makeAlumnus, makeStudent, validAsk } from "./factories";
import { PASSWORD, makeInstitute, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  testOutbox.length = 0;
});

const OPENING = "Hi, I'm working on SQL dashboards and would really value ten minutes of your advice on breaking into analytics. Thank you!";

async function scene() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const student = await makeStudent(institute.id);
  const alumnus = await makeAlumnus(institute.id, 1);
  const ask = await createAsk(student, validAsk());
  return { institute, admin, student, alumnus, ask };
}

describe("activity emails", () => {
  it("tells an alumnus about a new request without exposing the student's contact details", async () => {
    const { student, alumnus, ask } = await scene();
    await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });

    expect(testOutbox).toHaveLength(1);
    const mail = testOutbox[0]!;
    expect(mail.to).toBe(alumnus.email);
    expect(mail.subject).toBe("A student asked for your help");
    expect(mail.text).toContain("/alumni/requests/");
    expect(mail.text).not.toContain(student.email);
    expect(mail.text).not.toContain(OPENING);
    expect(mail.html).not.toContain(student.email);
  });

  it("emails the student when the alumnus accepts, and the alumnus about the first new message only", async () => {
    const { student, alumnus, ask } = await scene();
    const requestId = await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });
    testOutbox.length = 0;
    const { conversationId } = await acceptRequest(alumnus, requestId);
    expect(testOutbox.map((mail) => [mail.to, mail.subject])).toEqual([[student.email, "Your request was accepted"]]);
    expect(testOutbox[0]!.text).toContain(`/student/conversations/${conversationId}`);

    testOutbox.length = 0;
    await sendMessage(student, conversationId, { body: "Thanks so much for accepting!", aiAssisted: false });
    await sendMessage(student, conversationId, { body: "One more thing about SQL.", aiAssisted: false });
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: alumnus.email, subject: "You have a new message" });
    expect(testOutbox[0]!.text).not.toContain("Thanks so much");
  });

  it("respects the email switch", async () => {
    const { student, alumnus, ask } = await scene();
    await setEmailNotifications(alumnus, false);
    await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });
    expect(testOutbox).toHaveLength(0);
    // The in-app notification still exists.
    expect(await db.notification.count({ where: { userId: alumnus.id, kind: "request_received" } })).toBe(1);
  });

  it("emails an alumnus when their account is approved", async () => {
    const { institute, admin } = await scene();
    await db.institute.update({ where: { id: institute.id }, data: { requireApproval: true } });
    const member = await registerMember({ code: institute.joinCode, role: "alumni", name: "New Alum", email: "new@gmail.test", password: PASSWORD });
    expect(member.status).toBe("PENDING_APPROVAL");
    testOutbox.length = 0;
    await applyUserAction(admin, member.id, "approve");
    expect(testOutbox.map((mail) => [mail.to, mail.subject])).toEqual([["new@gmail.test", "Your Threadline account was approved"]]);
  });
});

describe("invite and reset emails", () => {
  it("emails the invite link and still returns it for copying", async () => {
    const { admin } = await scene();
    const { url, emailed } = await createInvite(admin, { email: "pat@gmail.test", role: "alumni", name: "Pat Lee" });
    expect(emailed).toBe(true);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: "pat@gmail.test", subject: "Alpha Institute invited you to Threadline" });
    expect(testOutbox[0]!.text).toContain(url);
    expect(testOutbox[0]!.html).toContain("Hi Pat");
  });

  it("emails the reset link to the member", async () => {
    const { admin, student } = await scene();
    const { url } = await createResetLink(admin, student.id);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: student.email, subject: "Reset your Threadline password" });
    expect(testOutbox[0]!.text).toContain(url);
  });

  it("escapes names so an invite cannot inject markup", async () => {
    const { admin } = await scene();
    await createInvite(admin, { email: "x@gmail.test", role: "student", name: "<script>alert(1)</script> Eve" });
    expect(testOutbox[0]!.html).not.toContain("<script>");
  });
});

describe("terms of use", () => {
  const base = { name: "Pat Lee", email: "pat@gmail.test", password: PASSWORD };
  it("is required on every account creation form", () => {
    expect(registerMemberSchema.safeParse({ ...base, code: "ABCD-2345", role: "student" }).success).toBe(false);
    expect(registerMemberSchema.safeParse({ ...base, code: "ABCD-2345", role: "student", acceptTerms: false }).success).toBe(false);
    expect(registerMemberSchema.safeParse({ ...base, code: "ABCD-2345", role: "student", acceptTerms: true }).success).toBe(true);
    expect(registerInstituteSchema.safeParse({ ...base, instituteName: "Alpha", domains: "alpha.test" }).success).toBe(false);
    expect(inviteAcceptSchema.safeParse({ token: "x".repeat(20), name: base.name, password: base.password }).success).toBe(false);
  });

  it("records which version was accepted", async () => {
    const { institute } = await scene();
    const member = await registerMember({ code: institute.joinCode, role: "student", name: "Pat Lee", email: "pat@alpha.test", password: PASSWORD });
    const row = await db.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(row.termsAcceptedAt).not.toBeNull();
    expect(row.termsVersion).toBeTruthy();
  });
});

describe("my data", () => {
  it("exports a person's own data without password hashes or other people's contact details", async () => {
    const { student, alumnus, ask } = await scene();
    const requestId = await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });
    const { conversationId } = await acceptRequest(alumnus, requestId);
    await sendMessage(alumnus, conversationId, { body: "Happy to help, let's talk SQL.", aiAssisted: false });

    const data = await exportMyData(student);
    const text = JSON.stringify(data);
    expect(data.account.email).toBe(student.email);
    expect(data.asks).toHaveLength(1);
    expect(data.conversations[0]!.messages.map((message) => message.body)).toContain("Happy to help, let's talk SQL.");
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain(alumnus.email);
    expect(text).not.toContain("+91 99999");
  });

  it("deletes an account: closes open work, erases details and blocks sign-in", async () => {
    const { institute, student, alumnus, ask } = await scene();
    const other = await makeAlumnus(institute.id, 2);
    await db.user.update({ where: { id: student.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    const accepted = await sendRequest(student, { askId: ask.id, alumniId: alumnus.id, message: OPENING });
    const { conversationId } = await acceptRequest(alumnus, accepted);
    await sendMessage(student, conversationId, { body: "My private message about my plans.", aiAssisted: false });
    const second = await createAsk(student, validAsk({ title: "Second ask about interviews" }));
    await sendRequest(student, { askId: second.id, alumniId: other.id, message: OPENING });

    await expect(deleteMyAccount(student, "wrong-password1")).rejects.toMatchObject({ status: 400 });
    await deleteMyAccount(student, PASSWORD);

    const row = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(row).toMatchObject({ name: "Deleted user", status: "DELETED", phone: null });
    expect(row.email).toContain("@deleted.invalid");
    expect(await db.studentProfile.count({ where: { userId: student.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    expect(await db.ask.count({ where: { studentId: student.id, status: { in: ["OPEN", "IN_PROGRESS"] } } })).toBe(0);
    expect((await db.ask.findMany({ where: { studentId: student.id } })).every((item) => item.title === "Deleted ask")).toBe(true);
    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).status).toBe("CLOSED");
    expect((await db.message.findMany({ where: { senderId: student.id } })).every((message) => message.body === "[message deleted]")).toBe(true);
    expect(await db.introRequest.count({ where: { studentId: student.id, state: "PENDING" } })).toBe(0);
    await expect(authenticate(student.email, PASSWORD, "student")).rejects.toMatchObject({ status: 400 });
  });

  it("does not let an institute admin delete their account this way", async () => {
    const { admin } = await scene();
    await expect(deleteMyAccount(admin, PASSWORD)).rejects.toMatchObject({ status: 403 });
  });
});
