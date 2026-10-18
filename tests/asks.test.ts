import { beforeEach, describe, expect, it } from "vitest";
import { autofillFallback } from "../lib/ai/autofill";
import { db } from "../lib/db";
import { cancelAsk, createAsk, expireAsks, askQuota, getOwnAsk, listAsks } from "../lib/services/asks";
import { getMatchesForAsk } from "../lib/services/matching";
import { askSchema } from "../lib/validation/ask";
import { makeAlumnus, makeStudent, validAsk } from "./factories";
import { makeInstitute, resetDb } from "./helpers";

beforeEach(resetDb);

describe("ask validation", () => {
  it("requires a skill, a real description and a company for referrals", () => {
    expect(() => askSchema.parse({ category: "mentorship", title: "Hello there", description: "short", skills: [{ name: "sql" }] })).toThrow(/sentence/);
    expect(() => askSchema.parse({ category: "mentorship", title: "Hello there", description: "x".repeat(30), skills: [] })).toThrow(/at least one skill/);
    expect(() => askSchema.parse({ category: "referral", title: "Hello there", description: "x".repeat(30), skills: [{ name: "sql" }] })).toThrow(/company/);
  });

  it("rejects a deadline in the past", () => {
    expect(() => validAsk({ deadline: "2020-01-01" })).toThrow(/past/);
    expect(validAsk({ deadline: "2999-01-01" }).deadline).toBe("2999-01-01");
  });
});

describe("autofill fallback", () => {
  it("reads category, skills, place and date from plain words", () => {
    const suggestion = autofillFallback("Need a referral for data analyst roles in Bengaluru by 2999-03-04. I know SQL and Power BI. It is urgent.");
    expect(suggestion).toMatchObject({ category: "referral", location: "Bengaluru", deadline: "2999-03-04", urgency: "HIGH" });
    expect(suggestion.skills).toEqual(expect.arrayContaining(["sql", "power bi"]));
    expect(suggestion.targetCompany).toBeNull();
  });
});

describe("asks and the monthly allowance", () => {
  it("creates an ask with normalised skills and stops at the monthly limit, counting cancelled asks", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    expect((await askQuota(student)).remaining).toBe(3);

    const first = await createAsk(student, validAsk({ skills: [{ name: "PowerBI" }, { name: "power bi" }, { name: "SQL" }] }));
    expect((await getOwnAsk(student, first.id)).skills.map((skill) => skill.name)).toEqual(["power bi", "sql"]);

    await cancelAsk(student, first.id);
    await createAsk(student, validAsk());
    await createAsk(student, validAsk());
    expect(await askQuota(student)).toEqual({ used: 3, limit: 3, remaining: 0 });
    await expect(createAsk(student, validAsk())).rejects.toMatchObject({ status: 409, message: expect.stringContaining("used all 3") });
  });

  it("honours an institute's own limit", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await db.institute.update({ where: { id: institute.id }, data: { monthlyAskLimit: 1 } });
    const student = await makeStudent(institute.id);
    await createAsk(student, validAsk());
    await expect(createAsk(student, validAsk())).rejects.toMatchObject({ status: 409 });
  });

  it("only lets students post asks", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const alumnus = await makeAlumnus(institute.id, 1);
    await expect(createAsk(alumnus, validAsk())).rejects.toMatchObject({ status: 403 });
  });

  it("expires asks past their deadline", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    const ask = await createAsk(student, validAsk({ deadline: "2999-01-01" }));
    await db.ask.update({ where: { id: ask.id }, data: { deadline: new Date("2020-01-01T00:00:00Z") } });
    expect(await expireAsks(institute.id)).toBe(1);
    expect((await getOwnAsk(student, ask.id)).status).toBe("EXPIRED");
    expect((await listAsks(student))[0]!.status).toBe("EXPIRED");
  });
});

describe("matches for an ask", () => {
  it("returns the top three with reasons, saves a snapshot once, and keeps contact details out", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    for (let n = 1; n <= 5; n += 1) await makeAlumnus(institute.id, n);
    await makeAlumnus(institute.id, 6, { skills: ["welding"], helpTypes: ["research"] });

    const ask = await createAsk(student, validAsk());
    const result = await getMatchesForAsk(student, ask.id);
    expect(result.live).toBe(true);
    expect(result.matches).toHaveLength(3);
    expect(result.matches.map((card) => card.rank)).toEqual([1, 2, 3]);
    expect(result.matches[0]!.reasons.length).toBeGreaterThan(0);
    expect(result.matches[0]!.breakdown.map((part) => part.label)).toContain("Skills");

    const snapshots = await db.matchSnapshot.count({ where: { askId: ask.id } });
    expect(snapshots).toBe(3);
    await getMatchesForAsk(student, ask.id);
    expect(await db.matchSnapshot.count({ where: { askId: ask.id } })).toBe(3);

    const json = JSON.stringify(result);
    for (const secret of ["maxActiveConnections", "acceptingRequests", "phone", "email", "@x.test", "99999", "passwordHash", "responsiveness", "headroom", "activeLoad"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("hides an alumnus at their own capacity or on pause, and shows them again once a slot frees up", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    const other = await makeStudent(institute.id, 2);
    const full = await makeAlumnus(institute.id, 1, { maxActiveConnections: 1 });
    await makeAlumnus(institute.id, 2, { acceptingRequests: false });
    const free = await makeAlumnus(institute.id, 3);

    const otherAsk = await createAsk(other, validAsk());
    const pending = await db.introRequest.create({
      data: { askId: otherAsk.id, studentId: other.id, alumniId: full.id, initialMessage: "Hello", expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const ask = await createAsk(student, validAsk());
    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).toEqual([free.id]);

    await db.introRequest.update({ where: { id: pending.id }, data: { state: "DECLINED", respondedAt: new Date() } });
    const after = (await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id);
    expect(after).toContain(full.id);
    expect(after).toContain(free.id);
  });

  it("hides an alumnus with four active conversations even if their own limit is higher", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    const popular = await makeAlumnus(institute.id, 1, { maxActiveConnections: 10 });
    const free = await makeAlumnus(institute.id, 2);
    for (let n = 0; n < 4; n += 1) {
      const peer = await makeStudent(institute.id, 10 + n);
      const peerAsk = await db.ask.create({ data: { instituteId: institute.id, studentId: peer.id, category: "mentorship", title: "Peer ask", description: "x".repeat(25) } });
      const request = await db.introRequest.create({
        data: { askId: peerAsk.id, studentId: peer.id, alumniId: popular.id, state: "ACCEPTED", respondedAt: new Date(), initialMessage: "Hi", expiresAt: new Date(Date.now() + 86_400_000) },
      });
      await db.conversation.create({ data: { introRequestId: request.id } });
    }
    const ask = await createAsk(student, validAsk());
    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).toEqual([free.id]);
  });

  it("does not offer someone who declined this student recently, or already got a request for this ask", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    const decliner = await makeAlumnus(institute.id, 1);
    const requested = await makeAlumnus(institute.id, 2);
    const fine = await makeAlumnus(institute.id, 3);
    const earlier = await db.ask.create({ data: { instituteId: institute.id, studentId: student.id, category: "mentorship", title: "Earlier ask", description: "x".repeat(25) } });
    await db.introRequest.create({ data: { askId: earlier.id, studentId: student.id, alumniId: decliner.id, state: "DECLINED", respondedAt: new Date(), initialMessage: "Hi", expiresAt: new Date() } });

    const ask = await createAsk(student, validAsk());
    await db.introRequest.create({ data: { askId: ask.id, studentId: student.id, alumniId: requested.id, initialMessage: "Hi", expiresAt: new Date(Date.now() + 86_400_000) } });
    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).toEqual([fine.id]);
  });

  it("never shows alumni from another institute and never lets another student read the ask", async () => {
    const alpha = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const beta = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    const student = await makeStudent(alpha.institute.id);
    const rival = await makeStudent(alpha.institute.id, 2);
    const mine = await makeAlumnus(alpha.institute.id, 1);
    await makeAlumnus(beta.institute.id, 2);
    const betaStudent = await makeStudent(beta.institute.id, 3);

    const ask = await createAsk(student, validAsk());
    expect((await getMatchesForAsk(student, ask.id)).matches.map((card) => card.alumnus.id)).toEqual([mine.id]);
    await expect(getMatchesForAsk(rival, ask.id)).rejects.toMatchObject({ status: 404 });
    await expect(getMatchesForAsk(betaStudent, ask.id)).rejects.toMatchObject({ status: 404 });
    await expect(getOwnAsk(rival, ask.id)).rejects.toMatchObject({ status: 404 });
    await expect(cancelAsk(rival, ask.id)).rejects.toMatchObject({ status: 404 });
  });

  it("shows the last saved matches for a closed ask instead of re-ranking", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id);
    const alumnus = await makeAlumnus(institute.id, 1);
    const ask = await createAsk(student, validAsk());
    await cancelAsk(student, ask.id);
    await db.alumniProfile.update({ where: { userId: alumnus.id }, data: { acceptingRequests: false } });
    const result = await getMatchesForAsk(student, ask.id);
    expect(result.live).toBe(false);
    expect(result.matches.map((card) => card.alumnus.id)).toEqual([alumnus.id]);
  });
});
