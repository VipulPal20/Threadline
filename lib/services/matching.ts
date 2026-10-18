import { db } from "../db";
import type { SessionUser } from "../auth/types";
import type { AskCategory } from "../domain/constants";
import { toMatchCard, type MatchCard } from "../dto/match";
import { notFound } from "../errors";
import { parseList } from "../json";
import { rankAlumni } from "../matching/rank";
import type { MatchAsk, MatchStudent, RankResult } from "../matching/types";
import { loadCandidates } from "./candidates";
import { expireRequests } from "./expiry";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS"];

async function loadAskContext(ask: { id: string }) {
  const row = await db.ask.findUniqueOrThrow({
    where: { id: ask.id },
    include: { skills: { include: { skill: true } }, student: { include: { studentProfile: true, skills: { include: { skill: true } } } } },
  });
  const profile = row.student.studentProfile;
  const matchAsk: MatchAsk = {
    id: row.id,
    studentId: row.studentId,
    category: row.category as AskCategory,
    title: row.title,
    description: row.description,
    domain: row.domain,
    targetRole: row.targetRole,
    targetCompany: row.targetCompany,
    location: row.location,
    workMode: row.workMode,
    skills: row.skills.map((entry) => ({ name: entry.skill.name, importance: entry.importance === "NICE" ? "NICE" : "MUST" })),
  };
  const student: MatchStudent = {
    department: profile?.department ?? null,
    graduationYear: profile?.graduationYear ?? null,
    city: profile?.city ?? null,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    skills: row.student.skills.map((entry) => entry.skill.name),
    targetRoles: parseList(profile?.targetRoles),
    interestedDomains: parseList(profile?.interestedDomains),
  };
  return { row, matchAsk, student };
}

/** Ranks alumni for an ask right now, from live profiles and load. Nothing is written. */
export async function computeRanking(ask: { id: string; studentId: string; instituteId: string }): Promise<RankResult> {
  await expireRequests(ask.instituteId);
  const [{ matchAsk, student }, candidates] = await Promise.all([loadAskContext(ask), loadCandidates(ask)]);
  return rankAlumni(matchAsk, student, candidates);
}

type SnapshotRow = { id: string; alumniId: string; rank: number; score: number; parts: string; reasons: string; computedAt: Date };

async function latestBatch(askId: string): Promise<SnapshotRow[]> {
  const newest = await db.matchSnapshot.findFirst({ where: { askId }, orderBy: { computedAt: "desc" }, select: { computedAt: true } });
  if (!newest) return [];
  return db.matchSnapshot.findMany({ where: { askId, computedAt: newest.computedAt }, orderBy: { rank: "asc" } });
}

/**
 * Saves the shown top three as an audit record, but only when it differs from the last saved
 * batch, so reloading a page does not pile up identical rows.
 */
export async function snapshotIfChanged(askId: string, result: RankResult): Promise<SnapshotRow[]> {
  const previous = await latestBatch(askId);
  const same =
    previous.length === result.matches.length &&
    previous.every((row, index) => row.alumniId === result.matches[index]!.alumniId && row.score === result.matches[index]!.score);
  if (same) return previous;
  if (result.matches.length === 0) return [];

  const computedAt = new Date();
  await db.matchSnapshot.createMany({
    data: result.matches.map((match) => ({
      askId,
      alumniId: match.alumniId,
      rank: match.rank,
      score: match.score,
      parts: JSON.stringify({ parts: match.parts, penalties: match.penalties }),
      reasons: JSON.stringify(match.reasons),
      computedAt,
    })),
  });
  return latestBatch(askId);
}

export interface AskMatches {
  matches: MatchCard[];
  eligibleCount: number;
  companyFilterRelaxed: boolean;
  /** False when the ask is closed and the cards come from the last saved snapshot. */
  live: boolean;
}

async function cardsFor(rows: SnapshotRow[]): Promise<MatchCard[]> {
  if (rows.length === 0) return [];
  const alumni = await db.user.findMany({
    where: { id: { in: rows.map((row) => row.alumniId) } },
    select: { id: true, name: true, alumniProfile: true, skills: { select: { skill: { select: { name: true } } }, orderBy: { skill: { name: "asc" } } } },
  });
  const byId = new Map(alumni.map((user) => [user.id, user]));
  return rows.flatMap((row) => {
    const alumnus = byId.get(row.alumniId);
    return alumnus ? [toMatchCard(row, alumnus)] : [];
  });
}

/** The top three for the asking student's own ask. Open asks are ranked live; closed ones show the last snapshot. */
export async function getMatchesForAsk(student: SessionUser, askId: string): Promise<AskMatches> {
  const ask = await db.ask.findFirst({ where: { id: askId, studentId: student.id, instituteId: student.instituteId } });
  if (!ask) throw notFound("Ask not found.");

  if (!OPEN_STATUSES.includes(ask.status)) {
    return { matches: await cardsFor(await latestBatch(ask.id)), eligibleCount: 0, companyFilterRelaxed: false, live: false };
  }
  const result = await computeRanking(ask);
  const rows = await snapshotIfChanged(ask.id, result);
  return { matches: await cardsFor(rows), eligibleCount: result.eligibleCount, companyFilterRelaxed: result.companyFilterRelaxed, live: true };
}
