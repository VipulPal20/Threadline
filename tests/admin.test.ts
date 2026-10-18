import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { csvCell, gini, mean, median, parseRange, topDecileShare, weekStart, weekStarts } from "../lib/metrics/stats";
import { getAdminAsk, getAdminUser, getSettings, listAdminAsks, rotateJoinCode, updateSettings } from "../lib/services/admin";
import { bulkCreateInvites, createInvite, previewInvite, resendInvite } from "../lib/services/invites";
import { exportAsksCsv, getMetrics } from "../lib/services/metrics";
import { listInstituteUsers } from "../lib/services/users";
import { adminAskFilterSchema, parseInviteCsv, settingsSchema } from "../lib/validation/admin";
import { makeAlumnus, makeStudent } from "./factories";
import { PASSWORD, makeInstitute, makeMember, resetDb } from "./helpers";

beforeEach(resetDb);

const at = (iso: string) => new Date(iso);
const T0 = "2026-10-14T09:00:00Z"; // a Wednesday
const hoursAfter = (hours: number) => new Date(at(T0).getTime() + hours * 3_600_000);
const NOW = at("2026-10-20T12:00:00Z");
const RANGE = { from: at("2026-10-01T00:00:00Z"), to: at("2026-10-31T23:59:59.999Z") };

describe("metric helpers", () => {
  it("computes median and mean", () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([2, 8])).toBe(5);
    expect(mean([1, 2, 6])).toBe(3);
    expect(mean([])).toBeNull();
  });

  it("computes the Gini coefficient and the top-decile share", () => {
    expect(gini([1, 1, 1, 1])).toBeCloseTo(0, 10);
    expect(gini([0, 0, 0, 10])).toBeCloseTo(0.75, 10);
    expect(gini([5])).toBeNull();
    expect(gini([0, 0])).toBeNull();
    expect(topDecileShare([1, 1, 1])).toBeCloseTo(1 / 3, 10);
    expect(topDecileShare([0, 0, 0, 0, 0, 0, 0, 0, 0, 10])).toBe(1);
    expect(topDecileShare([0, 0])).toBeNull();
    expect(topDecileShare([])).toBeNull();
  });

  it("buckets weeks from Monday and lists empty weeks too", () => {
    expect(weekStart(at("2026-10-14T09:00:00Z"))).toBe("2026-10-12");
    expect(weekStart(at("2026-10-18T23:59:00Z"))).toBe("2026-10-12");
    expect(weekStart(at("2026-10-19T00:00:00Z"))).toBe("2026-10-19");
    expect(weekStarts(RANGE.from, RANGE.to)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("parses date ranges, defaulting to 30 days and clamping to a year", () => {
    const fallback = parseRange(undefined, undefined, NOW);
    expect(fallback.to.toISOString()).toBe("2026-10-20T23:59:59.999Z");
    expect(Math.round((fallback.to.getTime() - fallback.from.getTime()) / 86_400_000)).toBe(30);
    expect(parseRange("2026-10-01", "2026-10-07").to.toISOString()).toBe("2026-10-07T23:59:59.999Z");
    expect(parseRange("nonsense", "2026-10-07", NOW).from.getTime()).toBeLessThan(at("2026-10-07").getTime());
    const clamped = parseRange("2000-01-01", "2026-10-07");
    expect(Math.round((clamped.to.getTime() - clamped.from.getTime()) / 86_400_000)).toBe(366);
    expect(parseRange("2026-10-10", "2026-10-01").from <= parseRange("2026-10-10", "2026-10-01").to).toBe(true);
  });

  it("quotes CSV cells and defuses spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(null)).toBe("");
    expect(csvCell(4)).toBe("4");
  });
});

/** A small institute whose every number is known in advance, so the dashboard can be checked by hand. */
async function seedKnownInstitute() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const s1 = await makeStudent(institute.id, 1);
  const s2 = await makeStudent(institute.id, 2);
  const a1 = await makeAlumnus(institute.id, 1, { skills: ["sql"] });
  const a2 = await makeAlumnus(institute.id, 2, { skills: ["sql"] });
  const a3 = await makeAlumnus(institute.id, 3, { skills: ["excel"] });
  const sql = await db.skill.upsert({ where: { name: "sql" }, create: { name: "sql" }, update: {} });
  const python = await db.skill.upsert({ where: { name: "python" }, create: { name: "python" }, update: {} });

  const mkAsk = (studentId: string, title: string, extra: Record<string, unknown>, skillIds: string[]) =>
    db.ask.create({
      data: { instituteId: institute.id, studentId, category: "mentorship", title, description: "x".repeat(30), domain: "data analytics", ...extra, skills: { create: skillIds.map((skillId) => ({ skillId })) } } as never,
    });

  const askA = await mkAsk(s1.id, "Ask A resolved", { status: "RESOLVED", createdAt: hoursAfter(0), resolvedAt: hoursAfter(27), rating: 5 }, [sql.id, python.id]);
  const askB = await mkAsk(s1.id, "Ask B declined", { status: "OPEN", createdAt: hoursAfter(2) }, [sql.id]);
  const askC = await mkAsk(s2.id, "Ask C nobody", { status: "OPEN", createdAt: hoursAfter(3), domain: "robotics" }, [sql.id]);
  const askD = await mkAsk(s2.id, "Ask D expired", { status: "EXPIRED", createdAt: hoursAfter(4) }, [sql.id]);
  const askE = await mkAsk(s2.id, "Ask E cancelled", { status: "CANCELLED", createdAt: hoursAfter(5) }, []);

  for (const [ask, alumnus] of [[askA, a1], [askB, a2], [askD, a3]] as const) {
    await db.matchSnapshot.create({ data: { askId: ask.id, alumniId: alumnus.id, rank: 1, score: 80, parts: "{}", reasons: "[]" } });
  }

  const reqA = await db.introRequest.create({ data: { askId: askA.id, studentId: s1.id, alumniId: a1.id, state: "CLOSED", initialMessage: "A private opening line", createdAt: hoursAfter(1), respondedAt: hoursAfter(3), closedAt: hoursAfter(27), expiresAt: hoursAfter(100) } });
  const conversation = await db.conversation.create({ data: { introRequestId: reqA.id, status: "CLOSED", createdAt: hoursAfter(3), lastMessageAt: hoursAfter(20) } });
  await db.message.create({ data: { conversationId: conversation.id, senderId: s1.id, body: "A very secret message body", createdAt: hoursAfter(3) } });
  await db.message.create({ data: { conversationId: conversation.id, senderId: a1.id, body: "Another secret reply", createdAt: hoursAfter(20) } });
  await db.introRequest.create({ data: { askId: askB.id, studentId: s1.id, alumniId: a2.id, state: "DECLINED", declineReason: "private decline reason", initialMessage: "B message", createdAt: hoursAfter(2), respondedAt: hoursAfter(10), closedAt: hoursAfter(10), expiresAt: hoursAfter(100) } });
  await db.introRequest.create({ data: { askId: askD.id, studentId: s2.id, alumniId: a3.id, state: "EXPIRED", initialMessage: "D message", createdAt: hoursAfter(4), closedAt: hoursAfter(76), expiresAt: hoursAfter(76) } });

  return { institute, admin, s1, s2, a1, a2, a3, askA, askB, askC, askD, askE };
}

describe("dashboard numbers match a hand count", () => {
  it("measures the known institute exactly", async () => {
    const { admin } = await seedKnownInstitute();
    const metrics = await getMetrics(admin, RANGE, NOW);

    expect(metrics.people).toEqual({ students: 2, alumni: 3, pendingApproval: 0, onboardingCompletion: 100 });
    expect(metrics.kpis).toMatchObject({
      asks: 5,
      resolved: 1,
      resolutionRate: 25, // 1 resolved of 4 asks (the cancelled one is not counted)
      medianHoursToFirstResponse: 5, // requests answered after 2h and 8h
      medianHoursToResolution: 27,
      acceptanceRate: 33.3, // 1 accepted of 3 decided (accepted, declined, expired)
      averageRating: 5,
      requests: 3,
    });
    expect(metrics.funnel.map((stage) => [stage.key, stage.count])).toEqual([["asked", 4], ["matched", 3], ["requested", 3], ["accepted", 1], ["resolved", 1]]);
    expect(metrics.funnel[0]!.percentOfAsks).toBe(100);
    expect(metrics.funnel[3]!.percentOfAsks).toBe(25);

    expect(metrics.statusBreakdown.find((row) => row.status === "RESOLVED")!.count).toBe(1);
    expect(metrics.statusBreakdown.find((row) => row.status === "CANCELLED")!.count).toBe(1);

    const week = metrics.trend.find((row) => row.week === "2026-10-12")!;
    expect(week).toMatchObject({ asks: 5, accepted: 1, resolved: 1 });
    expect(metrics.trend).toHaveLength(5);
    expect(metrics.trend.filter((row) => row.week !== "2026-10-12").every((row) => row.asks === 0 && row.accepted === 0 && row.resolved === 0)).toBe(true);

    expect(metrics.unmet).toEqual([{ label: "data analytics", count: 1 }, { label: "robotics", count: 1 }].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)));
    expect(metrics.demandSupply[0]).toEqual({ skill: "sql", demand: 4, supply: 2, gap: true });
    expect(metrics.demandSupply.find((row) => row.skill === "python")).toEqual({ skill: "python", demand: 1, supply: 0, gap: false });

    expect(metrics.engagement.activeAlumni).toBe(1);
    expect(metrics.engagement.topHelpers).toEqual([{ id: expect.any(String), name: "Alumnus 1", resolved: 1, averageRating: 5 }]);
    expect(metrics.fairness).toEqual({ requests: 3, alumniCount: 3, topDecileShare: 33.3, gini: 0 });
  });

  it("changes with the date range and reports empty data as null, not zero", async () => {
    const { admin } = await seedKnownInstitute();
    const empty = await getMetrics(admin, { from: at("2025-01-01T00:00:00Z"), to: at("2025-01-31T23:59:59Z") }, NOW);
    expect(empty.kpis).toMatchObject({ asks: 0, resolutionRate: null, medianHoursToFirstResponse: null, medianHoursToResolution: null, acceptanceRate: null, averageRating: null });
    expect(empty.funnel.every((stage) => stage.count === 0 && stage.percentOfAsks === null)).toBe(true);
    expect(empty.fairness.topDecileShare).toBeNull();
    expect(empty.demandSupply).toEqual([]);
  });

  it("only ever counts the admin's own institute", async () => {
    const { admin } = await seedKnownInstitute();
    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    const stranger = await makeStudent(other.institute.id, 7);
    await db.ask.create({ data: { instituteId: other.institute.id, studentId: stranger.id, category: "referral", title: "Beta ask", description: "x".repeat(30), createdAt: hoursAfter(1) } });
    expect((await getMetrics(other.admin, RANGE, NOW)).kpis.asks).toBe(1);
    expect((await getMetrics(admin, RANGE, NOW)).kpis.asks).toBe(5);
  });

  it("is for admins only", async () => {
    const { s1, a1 } = await seedKnownInstitute();
    await expect(getMetrics(s1, RANGE, NOW)).rejects.toMatchObject({ status: 403 });
    await expect(getMetrics(a1, RANGE, NOW)).rejects.toMatchObject({ status: 403 });
    await expect(listAdminAsks(s1, adminAskFilterSchema.parse({}))).rejects.toMatchObject({ status: 403 });
    await expect(exportAsksCsv(a1, RANGE)).rejects.toMatchObject({ status: 403 });
  });
});

describe("asks table, timeline and export", () => {
  it("filters and pages the institute's asks", async () => {
    const { admin, askA, institute } = await seedKnownInstitute();
    const all = await listAdminAsks(admin, adminAskFilterSchema.parse({}));
    expect(all.total).toBe(5);
    expect(all.rows[0]!.createdAt >= all.rows[4]!.createdAt).toBe(true);
    expect((await listAdminAsks(admin, adminAskFilterSchema.parse({ status: "RESOLVED" }))).rows.map((row) => row.id)).toEqual([askA.id]);
    expect((await listAdminAsks(admin, adminAskFilterSchema.parse({ domain: "robotics" }))).total).toBe(1);
    expect((await listAdminAsks(admin, adminAskFilterSchema.parse({ q: "Student 2" }))).total).toBe(3);
    expect((await listAdminAsks(admin, adminAskFilterSchema.parse({ from: "2026-10-15" }))).total).toBe(0);
    expect((await listAdminAsks(admin, adminAskFilterSchema.parse({ page: "2" }))).rows).toEqual([]);
    expect(institute.id).toBeTruthy();
  });

  it("tells the story of one ask without any message text, decline reason or contact detail", async () => {
    const { admin, askA, askB } = await seedKnownInstitute();
    const detail = await getAdminAsk(admin, askA.id);
    const texts = detail.timeline.map((event) => event.text);
    expect(texts[0]).toContain("Ask posted by Student 1");
    expect(texts).toEqual(expect.arrayContaining(["Top matches shown: Alumnus 1 (80%)", "Request sent to Alumnus 1", "Alumnus 1 accepted", "Conversation started", "2 messages exchanged (text is private)", "Marked resolved, rated 5/5"]));
    expect(detail.timeline.map((event) => event.at)).toEqual([...detail.timeline.map((event) => event.at)].sort());

    const declined = await getAdminAsk(admin, askB.id);
    expect(declined.timeline.map((event) => event.text)).toContain("Alumnus 2 declined");

    const json = JSON.stringify([detail, declined]);
    for (const secret of ["secret message", "secret reply", "private decline", "A private opening", "@x.test", "99999", "maxActiveConnections"]) expect(json).not.toContain(secret);
  });

  it("never shows another institute's ask", async () => {
    const { askA } = await seedKnownInstitute();
    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    await expect(getAdminAsk(other.admin, askA.id)).rejects.toMatchObject({ status: 404 });
    expect((await listAdminAsks(other.admin, adminAskFilterSchema.parse({}))).total).toBe(0);
  });

  it("exports a CSV of the period with formulas defused and no message text", async () => {
    const { admin, s2 } = await seedKnownInstitute();
    await db.user.update({ where: { id: s2.id }, data: { name: "=cmd|' /C calc'!A0" } });
    const csv = await exportAsksCsv(admin, RANGE);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("ask_id,created_at,student,category,domain,target_company,status,requests_sent,accepted,resolved_at,rating,hours_to_resolve");
    expect(lines).toHaveLength(6);
    expect(csv).toContain("'=cmd");
    expect(csv).not.toContain("secret");
    const resolved = lines.find((line) => line.includes("RESOLVED"))!;
    expect(resolved).toContain(",yes,");
    expect(resolved.endsWith(",5,27")).toBe(true);
  });
});

describe("members and settings", () => {
  it("searches members and shows a profile without capacity", async () => {
    const { admin, a1, s1, institute } = await seedKnownInstitute();
    expect((await listInstituteUsers(admin, { q: "alumnus 2" })).map((user) => user.name)).toEqual(["Alumnus 2"]);
    expect((await listInstituteUsers(admin, { q: "STUDENT1" })).map((user) => user.id)).toEqual([s1.id]);

    const view = await getAdminUser(admin, a1.id);
    expect(view.alumnus?.currentCompany).toBe("Northstar Labs");
    expect(view.stats).toEqual({ asks: 1, resolved: 1 });
    expect(JSON.stringify(view)).not.toMatch(/maxActiveConnections|acceptingRequests|passwordHash/);
    expect((await getAdminUser(admin, s1.id)).stats).toEqual({ asks: 2, resolved: 1 });

    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    await expect(getAdminUser(other.admin, a1.id)).rejects.toMatchObject({ status: 404 });
    await expect(getAdminUser(admin, admin.id)).rejects.toMatchObject({ status: 404 });
    expect(institute.id).toBeTruthy();
  });

  it("saves settings, records only what changed, and applies them", async () => {
    const { admin, institute } = await seedKnownInstitute();
    const saved = await updateSettings(admin, settingsSchema.parse({ name: "Alpha Tech", allowedEmailDomains: "alpha.test, mail.alpha.test", requireApproval: false, requestExpiryHours: 48, monthlyAskLimit: 5, aiEnabled: false }));
    expect(saved).toMatchObject({ name: "Alpha Tech", allowedEmailDomains: ["alpha.test", "mail.alpha.test"], requireApproval: false, requestExpiryHours: 48, monthlyAskLimit: 5, aiEnabled: false });
    const event = await db.auditEvent.findFirstOrThrow({ where: { kind: "institute.settings.updated" } });
    expect(JSON.parse(event.payload).changed.sort()).toEqual(["aiEnabled", "allowedEmailDomains", "monthlyAskLimit", "name", "requestExpiryHours", "requireApproval"]);

    // approval switched off: a new alumnus can sign straight in
    const alumnus = await makeMember(institute.joinCode, "alumni", "new@elsewhere.test");
    expect(alumnus.status).toBe("ACTIVE");
    await expect(getSettings({ ...admin, role: "STUDENT" })).rejects.toMatchObject({ status: 403 });
  });

  it("rejects unreasonable settings", () => {
    const base = { name: "Alpha", allowedEmailDomains: "alpha.test", requireApproval: true, requestExpiryHours: 24, monthlyAskLimit: 3, aiEnabled: true };
    expect(() => settingsSchema.parse({ ...base, requestExpiryHours: 0 })).toThrow(/at least 1 hour/);
    expect(() => settingsSchema.parse({ ...base, requestExpiryHours: 721 })).toThrow(/720/);
    expect(() => settingsSchema.parse({ ...base, monthlyAskLimit: 0 })).toThrow();
    expect(() => settingsSchema.parse({ ...base, allowedEmailDomains: "not a domain" })).toThrow(/valid domains/);
    expect(() => settingsSchema.parse({ ...base, name: "A" })).toThrow();
  });

  it("makes a new institute code and stops the old one working", async () => {
    const { admin, institute } = await seedKnownInstitute();
    const code = await rotateJoinCode(admin);
    expect(code).not.toBe(institute.joinCode);
    await expect(makeMember(institute.joinCode, "alumni", "late@elsewhere.test")).rejects.toMatchObject({ status: 400 });
    await expect(makeMember(code, "alumni", "late@elsewhere.test")).resolves.toMatchObject({ status: "PENDING_APPROVAL" });
  });
});

describe("bulk invites", () => {
  it("reads rows with or without a header and reports bad lines instead of failing", () => {
    const withHeader = parseInviteCsv("name,email,role\nAsha Rao,asha@x.test,student\n\nRavi,not-an-email,alumni\n,ravi2@x.test,mentor\nAsha Again,ASHA@x.test,alumni\n");
    expect(withHeader.rows).toEqual([{ line: 2, email: "asha@x.test", role: "student", name: "Asha Rao" }]);
    expect(withHeader.rejected.map((row) => [row.line, row.reason])).toEqual([
      [4, "Enter a valid email address."],
      [5, expect.any(String)],
      [6, "Listed twice in this file."],
    ]);

    const noHeader = parseInviteCsv('"Rao, Asha",asha@x.test,student\nRavi,ravi@x.test,alumni');
    expect(noHeader.rows.map((row) => [row.name, row.email, row.role])).toEqual([["Rao, Asha", "asha@x.test", "student"], ["Ravi", "ravi@x.test", "alumni"]]);

    const swapped = parseInviteCsv("role,email,name\nstudent,s@x.test,Sam");
    expect(swapped.rows).toEqual([{ line: 2, email: "s@x.test", role: "student", name: "Sam" }]);
    expect(parseInviteCsv("﻿email,role\nb@x.test,alumni").rows).toHaveLength(1);

    const big = parseInviteCsv(Array.from({ length: 205 }, (_, n) => `P${n},p${n}@x.test,student`).join("\n"));
    expect(big.rows).toHaveLength(200);
    expect(big.tooMany).toBe(true);
  });

  it("creates invites, skips people who already have accounts, and each link works once", async () => {
    const { admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await makeMember((await db.institute.findFirstOrThrow()).joinCode, "student", "existing@alpha.test");
    const result = await bulkCreateInvites(admin, "name,email,role\nNew One,one@x.test,alumni\nExisting,existing@alpha.test,student\nBad Row,bad,alumni\n");
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({ email: "one@x.test", role: "ALUMNI" });
    expect(result.skipped.map((row) => row.line)).toEqual([3, 4]);
    expect(result.skipped.find((row) => row.line === 3)!.reason).toMatch(/already exists/);

    const token = result.created[0]!.url.split("/invite/")[1]!;
    await expect(previewInvite(token)).resolves.toMatchObject({ email: "one@x.test" });
    expect(await db.invite.count()).toBe(1);
  });

  it("gives a fresh link on resend and kills the old one", async () => {
    const { admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const { invite, url } = await createInvite(admin, { email: "one@x.test", role: "alumni" });
    const oldToken = url.split("/invite/")[1]!;
    const again = await resendInvite(admin, invite.id);
    const newToken = again.url.split("/invite/")[1]!;
    expect(newToken).not.toBe(oldToken);
    await expect(previewInvite(oldToken)).rejects.toMatchObject({ status: 404 });
    await expect(previewInvite(newToken)).resolves.toMatchObject({ email: "one@x.test" });

    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    await expect(resendInvite(other.admin, invite.id)).rejects.toMatchObject({ status: 404 });
    await expect(resendInvite({ ...admin, role: "STUDENT" }, invite.id)).rejects.toMatchObject({ status: 403 });
    expect(PASSWORD).toBeTruthy();
  });
});
