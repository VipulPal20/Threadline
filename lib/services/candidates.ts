import { db } from "../db";
import { parseList } from "../json";
import type { MatchAlumnus } from "../matching/types";
import { MATCHING_CONFIG } from "../matching/weights";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Loads every alumnus in the institute who could be ranked, with the private load figures the
 * ranker needs. Only alumni who are ACTIVE and have finished onboarding are returned.
 * The result stays on the server: it is input to the ranker and never serialised to a client.
 */
export async function loadCandidates(ask: { id: string; studentId: string; instituteId: string }, now = new Date()): Promise<MatchAlumnus[]> {
  const users = await db.user.findMany({
    where: { instituteId: ask.instituteId, role: "ALUMNI", status: "ACTIVE", onboardingComplete: true, alumniProfile: { isNot: null } },
    include: {
      alumniProfile: true,
      skills: { include: { skill: true } },
      experiences: { select: { title: true, organisation: true, description: true } },
    },
  });
  if (users.length === 0) return [];

  const requests = await db.introRequest.findMany({
    where: { alumniId: { in: users.map((user) => user.id) } },
    select: {
      alumniId: true,
      studentId: true,
      askId: true,
      state: true,
      createdAt: true,
      respondedAt: true,
      conversation: { select: { status: true } },
    },
  });
  const byAlumnus = new Map<string, typeof requests>();
  for (const request of requests) byAlumnus.set(request.alumniId, [...(byAlumnus.get(request.alumniId) ?? []), request]);

  const weekAgo = now.getTime() - 7 * DAY_MS;
  const cooldownStart = now.getTime() - MATCHING_CONFIG.declineCooldownDays * DAY_MS;

  return users.flatMap((user): MatchAlumnus[] => {
    const profile = user.alumniProfile;
    if (!profile) return [];
    const mine = byAlumnus.get(user.id) ?? [];

    const live = (request: (typeof mine)[number]) => request.state === "ACCEPTED" && (request.conversation?.status ?? "ACTIVE") === "ACTIVE";
    const accepted = mine.filter((request) => request.respondedAt && (request.state === "ACCEPTED" || request.state === "CLOSED"));
    const decided = mine.filter((request) => ["ACCEPTED", "CLOSED", "DECLINED", "EXPIRED"].includes(request.state));
    const responded = mine.filter((request) => request.respondedAt);
    const avgResponseHours = responded.length
      ? responded.reduce((sum, request) => sum + (request.respondedAt!.getTime() - request.createdAt.getTime()) / 3_600_000, 0) / responded.length
      : null;

    return [
      {
        id: user.id,
        name: user.name,
        acceptingRequests: profile.acceptingRequests,
        helpTypes: parseList(profile.helpTypes),
        currentCompany: profile.currentCompany,
        referralCompanies: parseList(profile.referralCompanies),
        currentTitle: profile.currentTitle,
        industry: profile.industry,
        yearsExperience: profile.yearsExperience,
        city: profile.city,
        workMode: profile.workMode,
        department: profile.department,
        graduationYear: profile.graduationYear,
        headline: profile.headline,
        bio: profile.bio,
        experienceText: user.experiences.map((item) => [item.title, item.organisation, item.description].filter(Boolean).join(" ")).join(". "),
        skills: user.skills.map((row) => ({ name: row.skill.name, level: row.level })),
        maxActiveConnections: profile.maxActiveConnections,
        activeLoad: mine.filter((request) => request.state === "PENDING" || live(request)).length,
        activeConversations: mine.filter(live).length,
        recentRequests: mine.filter((request) => request.createdAt.getTime() >= weekAgo).length,
        acceptedCount: accepted.length,
        decidedCount: decided.length,
        avgResponseHours,
        recentlyDeclinedThisStudent: mine.some(
          (request) => request.studentId === ask.studentId && request.state === "DECLINED" && (request.respondedAt?.getTime() ?? 0) >= cooldownStart,
        ),
        alreadyRequestedForAsk: mine.some((request) => request.askId === ask.id),
      },
    ];
  });
}
