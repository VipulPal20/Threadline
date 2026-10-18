import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { forbidden } from "../errors";
import { CATEGORY_LABELS } from "../domain/labels";
import type { AskCategory } from "../domain/constants";
import { csvRow, gini, hoursBetween, mean, median, percent, round, topDecileShare, weekStart, weekStarts, type DateRange } from "../metrics/stats";
import { expireRequests } from "./expiry";
import { expireAsks } from "./asks";

const DAY_MS = 86_400_000;

function assertAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw forbidden();
}

/** Asks created in the range, with just enough related data to measure the journey. Never loads message text. */
async function loadAsks(instituteId: string, range: DateRange) {
  return db.ask.findMany({
    where: { instituteId, createdAt: { gte: range.from, lte: range.to } },
    include: {
      student: { select: { name: true } },
      skills: { select: { skill: { select: { name: true } } } },
      _count: { select: { snapshots: true } },
      requests: { select: { id: true, state: true, createdAt: true, respondedAt: true, alumniId: true, conversation: { select: { id: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

type AskRow = Awaited<ReturnType<typeof loadAsks>>[number];

/** A request was accepted if it ever got a conversation (accepted requests keep it after they close). */
const wasAccepted = (request: AskRow["requests"][number]) => request.conversation !== null;

export async function getMetrics(admin: SessionUser, range: DateRange, now = new Date()) {
  assertAdmin(admin);
  const instituteId = admin.instituteId;
  await Promise.all([expireRequests(instituteId, now), expireAsks(instituteId, now)]);

  const [asks, students, alumniRows, pendingApproval, requestsInRange, conversationsInRange, resolvedInRange, recentConversations] = await Promise.all([
    loadAsks(instituteId, range),
    db.user.count({ where: { instituteId, role: "STUDENT", status: "ACTIVE" } }),
    db.user.findMany({ where: { instituteId, role: "ALUMNI", status: "ACTIVE" }, select: { id: true, onboardingComplete: true, skills: { select: { skill: { select: { name: true } } } } } }),
    db.user.count({ where: { instituteId, status: "PENDING_APPROVAL" } }),
    db.introRequest.findMany({
      where: { ask: { instituteId }, createdAt: { gte: range.from, lte: range.to } },
      select: { state: true, createdAt: true, respondedAt: true, alumniId: true, conversation: { select: { id: true } } },
    }),
    db.conversation.findMany({ where: { introRequest: { ask: { instituteId } }, createdAt: { gte: range.from, lte: range.to } }, select: { createdAt: true } }),
    db.ask.findMany({
      where: { instituteId, status: "RESOLVED", resolvedAt: { gte: range.from, lte: range.to } },
      select: { resolvedAt: true, rating: true, requests: { where: { conversation: { isNot: null } }, select: { alumniId: true } } },
    }),
    db.conversation.findMany({ where: { introRequest: { ask: { instituteId } }, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } }, select: { introRequest: { select: { alumniId: true } } } }),
  ]);

  const activeAlumni = alumniRows.filter((alumnus) => alumnus.onboardingComplete);
  const members = students + alumniRows.length;
  const onboarded = (await db.user.count({ where: { instituteId, role: "STUDENT", status: "ACTIVE", onboardingComplete: true } })) + activeAlumni.length;

  /* ----- cohort measures: asks created in the range ----- */
  const counted = asks.filter((ask) => ask.status !== "CANCELLED");
  const resolved = asks.filter((ask) => ask.status === "RESOLVED");
  const resolutionHours = resolved.filter((ask) => ask.resolvedAt).map((ask) => hoursBetween(ask.createdAt, ask.resolvedAt!));
  const ratings = resolved.flatMap((ask) => (ask.rating ? [ask.rating] : []));

  const responseHours = requestsInRange.filter((request) => request.respondedAt).map((request) => hoursBetween(request.createdAt, request.respondedAt!));
  const acceptedRequests = requestsInRange.filter((request) => request.conversation !== null).length;
  const decided = requestsInRange.filter((request) => request.conversation !== null || request.state === "DECLINED" || request.state === "EXPIRED").length;

  const statusBreakdown = ["OPEN", "IN_PROGRESS", "RESOLVED", "EXPIRED", "CANCELLED"].map((status) => ({ status, count: asks.filter((ask) => ask.status === status).length }));

  const funnel = [
    { key: "asked", label: "Asks posted", count: counted.length },
    { key: "matched", label: "Matches shown", count: counted.filter((ask) => ask._count.snapshots > 0).length },
    { key: "requested", label: "Request sent", count: counted.filter((ask) => ask.requests.length > 0).length },
    { key: "accepted", label: "Accepted", count: counted.filter((ask) => ask.requests.some(wasAccepted)).length },
    { key: "resolved", label: "Resolved", count: counted.filter((ask) => ask.status === "RESOLVED").length },
  ].map((stage) => ({ ...stage, percentOfAsks: percent(stage.count, counted.length) }));

  /* ----- weekly trend: events counted in the week they happened ----- */
  const weeks = weekStarts(range.from, range.to);
  const trendMap = new Map(weeks.map((week) => [week, { week, asks: 0, accepted: 0, resolved: 0 }]));
  for (const ask of asks) {
    const bucket = trendMap.get(weekStart(ask.createdAt));
    if (bucket) bucket.asks += 1;
  }
  for (const conversation of conversationsInRange) {
    const bucket = trendMap.get(weekStart(conversation.createdAt));
    if (bucket) bucket.accepted += 1;
  }
  for (const ask of resolvedInRange) {
    const bucket = ask.resolvedAt ? trendMap.get(weekStart(ask.resolvedAt)) : undefined;
    if (bucket) bucket.resolved += 1;
  }

  /* ----- demand versus supply of skills ----- */
  const demand = new Map<string, number>();
  for (const ask of counted) for (const entry of ask.skills) demand.set(entry.skill.name, (demand.get(entry.skill.name) ?? 0) + 1);
  const supply = new Map<string, number>();
  for (const alumnus of activeAlumni) for (const entry of alumnus.skills) supply.set(entry.skill.name, (supply.get(entry.skill.name) ?? 0) + 1);
  const demandSupply = [...demand.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([skill, asked]) => {
      const available = supply.get(skill) ?? 0;
      return { skill, demand: asked, supply: available, gap: asked >= 2 && (available === 0 || asked / available >= 2) };
    });

  /* ----- unmet demand: never accepted, and either expired or nobody was available ----- */
  const unmetCounts = new Map<string, number>();
  for (const ask of counted) {
    const neverAccepted = !ask.requests.some(wasAccepted);
    if (neverAccepted && (ask.status === "EXPIRED" || ask._count.snapshots === 0)) {
      const label = ask.domain?.trim() || CATEGORY_LABELS[ask.category as AskCategory] || ask.category;
      unmetCounts.set(label, (unmetCounts.get(label) ?? 0) + 1);
    }
  }
  const unmet = [...unmetCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([label, count]) => ({ label, count }));

  /* ----- engagement and who is carrying the load ----- */
  const activeAlumniIds = new Set(recentConversations.map((conversation) => conversation.introRequest.alumniId));
  const helperTally = new Map<string, { resolved: number; ratings: number[] }>();
  for (const ask of resolvedInRange) {
    for (const request of ask.requests) {
      const tally = helperTally.get(request.alumniId) ?? { resolved: 0, ratings: [] };
      tally.resolved += 1;
      if (ask.rating) tally.ratings.push(ask.rating);
      helperTally.set(request.alumniId, tally);
    }
  }
  const topHelperIds = [...helperTally.entries()].sort((a, b) => b[1].resolved - a[1].resolved).slice(0, 5);
  const helperNames = new Map((await db.user.findMany({ where: { id: { in: topHelperIds.map(([id]) => id) } }, select: { id: true, name: true } })).map((user) => [user.id, user.name]));
  const topHelpers = topHelperIds.map(([id, tally]) => ({ id, name: helperNames.get(id) ?? "Alumnus", resolved: tally.resolved, averageRating: mean(tally.ratings) === null ? null : round(mean(tally.ratings)!) }));

  const requestsPerAlumnus = new Map<string, number>(activeAlumni.map((alumnus) => [alumnus.id, 0]));
  for (const request of requestsInRange) if (requestsPerAlumnus.has(request.alumniId)) requestsPerAlumnus.set(request.alumniId, requestsPerAlumnus.get(request.alumniId)! + 1);
  const loads = [...requestsPerAlumnus.values()];
  const decile = topDecileShare(loads);
  const giniValue = gini(loads);

  return {
    range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10) },
    people: { students, alumni: alumniRows.length, pendingApproval, onboardingCompletion: percent(onboarded, members) },
    kpis: {
      asks: asks.length,
      resolved: resolved.length,
      resolutionRate: percent(resolved.length, counted.length),
      medianHoursToFirstResponse: median(responseHours) === null ? null : round(median(responseHours)!),
      medianHoursToResolution: median(resolutionHours) === null ? null : round(median(resolutionHours)!),
      acceptanceRate: percent(acceptedRequests, decided),
      averageRating: mean(ratings) === null ? null : round(mean(ratings)!, 2),
      requests: requestsInRange.length,
    },
    statusBreakdown,
    funnel,
    trend: weeks.map((week) => trendMap.get(week)!),
    demandSupply,
    unmet,
    engagement: { activeAlumni: activeAlumniIds.size, topHelpers },
    fairness: { requests: requestsInRange.length, alumniCount: loads.length, topDecileShare: decile === null ? null : round(100 * decile), gini: giniValue === null ? null : round(giniValue, 2) },
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;

/** CSV of every ask created in the range. Names are shown to admins already; message text is never included. */
export async function exportAsksCsv(admin: SessionUser, range: DateRange): Promise<string> {
  assertAdmin(admin);
  await expireAsks(admin.instituteId);
  const asks = await loadAsks(admin.instituteId, range);
  const header = csvRow(["ask_id", "created_at", "student", "category", "domain", "target_company", "status", "requests_sent", "accepted", "resolved_at", "rating", "hours_to_resolve"]);
  const rows = asks.map((ask) =>
    csvRow([
      ask.id,
      ask.createdAt.toISOString(),
      ask.student.name,
      ask.category,
      ask.domain,
      ask.targetCompany,
      ask.status,
      ask.requests.length,
      ask.requests.some(wasAccepted) ? "yes" : "no",
      ask.resolvedAt?.toISOString() ?? "",
      ask.rating,
      ask.resolvedAt ? round(hoursBetween(ask.createdAt, ask.resolvedAt)) : "",
    ]),
  );
  return [header, ...rows].join("\n") + "\n";
}
