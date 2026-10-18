import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { resetRateLimits } from "../lib/auth/rate-limit";
import { db } from "../lib/db";
import { cancelAsk, createAsk, expireAsks, getOwnAsk } from "../lib/services/asks";
import { sendMessage, getConversation, resolveAsk } from "../lib/services/conversations";
import { getMatchesForAsk } from "../lib/services/matching";
import { listNotifications } from "../lib/services/notifications";
import { acceptRequest, sendRequest } from "../lib/services/requests";
import { assertBodyUnder, handle } from "../lib/http";
import { makeAlumnus, makeStudent, validAsk } from "./factories";
import { makeInstitute, resetDb } from "./helpers";

beforeEach(resetDb);

const MESSAGE = "Hi, I'm working on SQL dashboards and would really value ten minutes of your advice on breaking into analytics. Thank you!";

async function scene() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const student = await makeStudent(institute.id, 1);
  const a1 = await makeAlumnus(institute.id, 1);
  const a2 = await makeAlumnus(institute.id, 2);
  const ask = await createAsk(student, validAsk());
  return { institute, admin, student, a1, a2, ask };
}

describe("cancelling an ask releases everyone tied to it", () => {
  it("withdraws pending requests, tells the alumni, and frees their places", async () => {
    const { institute, student, a1, ask } = await scene();
    const requestId = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await cancelAsk(student, ask.id);

    expect((await db.introRequest.findUniqueOrThrow({ where: { id: requestId } })).state).toBe("WITHDRAWN");
    expect((await listNotifications(a1)).notifications.map((item) => item.kind)).toContain("request_withdrawn");
    await expect(acceptRequest(a1, requestId)).rejects.toMatchObject({ status: 409 });

    const next = await makeStudent(institute.id, 2);
    const nextAsk = await createAsk(next, validAsk());
    expect((await getMatchesForAsk(next, nextAsk.id)).matches.map((card) => card.alumnus.id)).toContain(a1.id);
  });

  it("ends an active conversation too, so the chat stops and the alumnus is free again", async () => {
    const { institute, student, a1, ask } = await scene();
    const requestId = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    const { conversationId } = await acceptRequest(a1, requestId);
    await cancelAsk(student, ask.id);

    expect((await db.conversation.findUniqueOrThrow({ where: { id: conversationId } })).status).toBe("CLOSED");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id: requestId } })).state).toBe("CLOSED");
    expect((await getConversation(a1, conversationId)).other).not.toHaveProperty("contacts");
    await expect(sendMessage(student, conversationId, { body: "still there?", aiAssisted: false })).rejects.toMatchObject({ status: 409 });
    expect((await listNotifications(a1)).notifications.map((item) => item.kind)).toContain("conversation_ended");

    const next = await makeStudent(institute.id, 2);
    const nextAsk = await createAsk(next, validAsk());
    expect((await getMatchesForAsk(next, nextAsk.id)).matches.map((card) => card.alumnus.id)).toContain(a1.id);
  });
});

describe("a deadline only ends asks nobody has accepted", () => {
  it("expires an open ask together with its waiting requests, but leaves an ask in progress alone", async () => {
    const { institute, student, a1, a2, ask } = await scene();
    const pending = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await db.ask.update({ where: { id: ask.id }, data: { deadline: new Date("2020-01-01T00:00:00Z") } });
    expect(await expireAsks(institute.id)).toBe(1);
    expect((await getOwnAsk(student, ask.id)).status).toBe("EXPIRED");
    expect((await db.introRequest.findUniqueOrThrow({ where: { id: pending } })).state).toBe("EXPIRED");
    expect((await listNotifications(a1)).notifications.map((item) => item.kind)).toContain("request_expired");

    const other = await makeStudent(institute.id, 2);
    const helped = await createAsk(other, validAsk());
    const requestId = await sendRequest(other, { askId: helped.id, alumniId: a2.id, message: MESSAGE });
    await acceptRequest(a2, requestId);
    await db.ask.update({ where: { id: helped.id }, data: { deadline: new Date("2020-01-01T00:00:00Z") } });
    expect(await expireAsks(institute.id)).toBe(0);
    expect((await getOwnAsk(other, helped.id)).status).toBe("IN_PROGRESS");
  });
});

describe("things that happen at the same moment", () => {
  it("lets exactly one of two alumni win when both accept at once", async () => {
    const { student, a1, a2, ask } = await scene();
    const first = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    const second = await sendRequest(student, { askId: ask.id, alumniId: a2.id, message: MESSAGE });
    const results = await Promise.allSettled([acceptRequest(a1, first), acceptRequest(a2, second)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.conversation.count()).toBe(1);
    expect(await db.introRequest.count({ where: { askId: ask.id, state: "ACCEPTED" } })).toBe(1);
    expect((await db.ask.findUniqueOrThrow({ where: { id: ask.id } })).status).toBe("IN_PROGRESS");
  });

  it("records a resolution once when it is submitted twice at once", async () => {
    const { student, a1, ask } = await scene();
    const requestId = await sendRequest(student, { askId: ask.id, alumniId: a1.id, message: MESSAGE });
    await acceptRequest(a1, requestId);
    const results = await Promise.allSettled([resolveAsk(student, ask.id, { rating: 5, note: null }), resolveAsk(student, ask.id, { rating: 1, note: null })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.auditEvent.count({ where: { kind: "ask.resolved" } })).toBe(1);
    expect([1, 5]).toContain((await db.ask.findUniqueOrThrow({ where: { id: ask.id } })).rating);
  });

  it("does not let two quick posts slip past the monthly allowance", async () => {
    const { institute } = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    await db.institute.update({ where: { id: institute.id }, data: { monthlyAskLimit: 1 } });
    const student = await makeStudent(institute.id, 1);
    const results = await Promise.allSettled([createAsk(student, validAsk()), createAsk(student, validAsk())]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.ask.count({ where: { studentId: student.id } })).toBe(1);
  });
});

describe("request limits", () => {
  it("keeps guessing one account's password from going on forever, whatever X-Forwarded-For says", async () => {
    resetRateLimits();
    const attempt = (n: number) =>
      login(
        new NextRequest("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${Math.floor(n / 200)}.${n % 200}` },
          body: JSON.stringify({ email: "target@alpha.test", password: `wrong-guess-${n}`, role: "student" }),
        }),
        {},
      );
    for (let n = 0; n < 25; n += 1) expect((await attempt(n)).status).toBe(400);
    expect((await attempt(25)).status).toBe(429);
    resetRateLimits();
  }, 90_000); // each wrong guess runs a real password hash, which is deliberately slow

  it("refuses oversized bodies before reading them, and turns a unique-constraint clash into a clean 409", async () => {
    const big = new NextRequest("http://localhost/api/x", { method: "POST", headers: { "content-length": "2000000" }, body: "{}" });
    expect(() => assertBodyUnder(big, 1_000_000)).toThrowError(/too large/);
    expect(() => assertBodyUnder(new NextRequest("http://localhost/api/x", { method: "POST", body: "{}" }), 1_000_000)).not.toThrow();

    const clash = handle(async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    });
    const response = await clash(new NextRequest("http://localhost/api/x"), {});
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That already exists." });
  });
});
