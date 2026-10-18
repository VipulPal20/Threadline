import { LIMITS } from "../domain/constants";
import { applyHardFilters } from "./filters";
import { buildReasons } from "./reasons";
import { normalizeSkill } from "./skills-normalize";
import { sameText, tfidfCosine, tokenOverlap } from "./text";
import type { MatchAlumnus, MatchAsk, MatchStudent, PartKey, RankResult, RankedMatch } from "./types";
import { MATCHING_CONFIG, type MatchingConfig } from "./weights";

const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Weighted coverage of the ask's skills by the alumnus's skills; "must" skills count double. */
export function skillsScore(ask: MatchAsk, alumnus: MatchAlumnus, config: MatchingConfig): number {
  if (ask.skills.length === 0) return 0;
  const levels = new Map(alumnus.skills.map((skill) => [normalizeSkill(skill.name), skill.level]));
  let earned = 0;
  let possible = 0;
  for (const skill of ask.skills) {
    const weight = skill.importance === "MUST" ? config.mustSkillWeight : config.niceSkillWeight;
    possible += weight;
    const level = levels.get(normalizeSkill(skill.name));
    if (level !== undefined) earned += weight * (config.skillLevelCredit[level] ?? config.skillLevelCredit.INTERMEDIATE ?? 0.8);
  }
  return possible ? earned / possible : 0;
}

/** Target company, domain and job-title fit. Components the ask does not specify are left out and the rest re-weighted. */
export function roleFitScore(ask: MatchAsk, alumnus: MatchAlumnus): number {
  const parts: Array<{ weight: number; value: number }> = [];
  if (ask.targetCompany?.trim()) {
    const atCompany = sameText(alumnus.currentCompany, ask.targetCompany) || alumnus.referralCompanies.some((company) => sameText(company, ask.targetCompany));
    parts.push({ weight: 0.5, value: atCompany ? 1 : 0 });
  }
  if (ask.domain?.trim()) parts.push({ weight: 0.25, value: Math.max(tokenOverlap(ask.domain, alumnus.industry), tokenOverlap(ask.domain, alumnus.headline)) });
  if (ask.targetRole?.trim()) parts.push({ weight: 0.25, value: tokenOverlap(ask.targetRole, alumnus.currentTitle) });
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  return total ? parts.reduce((sum, part) => sum + part.weight * part.value, 0) / total : 0;
}

/** How well the asking student's own profile lines up with the alumnus. */
export function studentFitScore(student: MatchStudent, alumnus: MatchAlumnus): number {
  const left = new Set(student.skills.map(normalizeSkill));
  const right = new Set(alumnus.skills.map((skill) => normalizeSkill(skill.name)));
  const union = new Set([...left, ...right]);
  const shared = [...left].filter((name) => right.has(name)).length;
  const skillOverlap = union.size ? shared / union.size : 0;

  const direction = Math.max(
    tokenOverlap(student.interestedDomains.join(" "), `${alumnus.industry ?? ""} ${alumnus.currentTitle ?? ""}`),
    tokenOverlap(student.targetRoles.join(" "), alumnus.currentTitle),
  );
  return 0.5 * skillOverlap + 0.5 * direction;
}

export function affiliationScore(student: MatchStudent, alumnus: MatchAlumnus): number {
  const department = sameText(student.department, alumnus.department) ? 0.6 : 0;
  const batch = student.graduationYear != null && alumnus.graduationYear != null && Math.abs(student.graduationYear - alumnus.graduationYear) <= 3 ? 0.4 : 0;
  return department + batch;
}

export function locationScore(ask: MatchAsk, student: MatchStudent, alumnus: MatchAlumnus): number {
  const wanted = ask.location ?? student.city;
  if (sameText(wanted, alumnus.city)) return 1;
  return ask.workMode === "REMOTE" || alumnus.workMode === "REMOTE" ? 0.5 : 0;
}

/** Full credit inside the ideal range of experience for the ask type, fading 15% per year outside it. */
export function experienceScore(ask: MatchAsk, alumnus: MatchAlumnus, config: MatchingConfig): number {
  if (alumnus.yearsExperience == null) return 0.5;
  const [low, high] = config.experienceRanges[ask.category] ?? [0, 60];
  const years = alumnus.yearsExperience;
  if (years < low) return clamp01(1 - 0.15 * (low - years));
  if (years > high) return clamp01(1 - 0.15 * (years - high));
  return 1;
}

/** Acceptance rate and speed, smoothed with a prior so alumni with no history are neither favoured nor punished. */
export function responsivenessScore(alumnus: MatchAlumnus, config: MatchingConfig): number {
  const { acceptRate, weight } = config.responsivenessPrior;
  const rate = (alumnus.acceptedCount + acceptRate * weight) / (alumnus.decidedCount + weight);
  const speed = alumnus.avgResponseHours == null ? 0.5 : 1 - clamp01(alumnus.avgResponseHours / 72);
  return 0.7 * rate + 0.3 * speed;
}

export function headroomScore(alumnus: MatchAlumnus): number {
  return alumnus.maxActiveConnections > 0 ? clamp01(1 - alumnus.activeLoad / alumnus.maxActiveConnections) : 0;
}

/** Ramps from 0 below the soft cap to the full penalty at the soft cap (they are hidden at the hard cap). */
function conversationLoadFactor(activeConversations: number): number {
  const { softActiveConversations: soft, maxActiveConversations: hard } = LIMITS;
  if (activeConversations < soft) return 0;
  return clamp01((activeConversations - soft + 1) / Math.max(1, hard - soft));
}

/**
 * Hard filters, then a fixed weighted score, then the top three. Pure and deterministic:
 * the same inputs always give the same order (ties broken by alumnus id).
 */
export function rankAlumni(
  ask: MatchAsk,
  student: MatchStudent,
  alumni: readonly MatchAlumnus[],
  config: MatchingConfig = MATCHING_CONFIG,
  limit = 3,
): RankResult {
  const { eligible, companyFilterRelaxed } = applyHardFilters(ask, alumni);
  if (eligible.length === 0) return { matches: [], eligibleCount: 0, companyFilterRelaxed };

  const askText = [ask.title, ask.description, ask.domain, ask.targetRole, ask.targetCompany, ask.skills.map((skill) => skill.name).join(" ")].filter(Boolean).join(". ");
  const similarities = tfidfCosine(
    askText,
    eligible.map((alumnus) =>
      [alumnus.headline, alumnus.bio, alumnus.currentTitle, alumnus.industry, alumnus.currentCompany, alumnus.skills.map((skill) => skill.name).join(" "), alumnus.experienceText].filter(Boolean).join(". "),
    ),
  );
  const maxRecent = Math.max(1, ...eligible.map((alumnus) => alumnus.recentRequests));

  const ranked = eligible.map((alumnus, index) => {
    const parts: Record<PartKey, number> = {
      skills: skillsScore(ask, alumnus, config),
      text: similarities[index] ?? 0,
      roleFit: roleFitScore(ask, alumnus),
      studentFit: studentFitScore(student, alumnus),
      affiliation: affiliationScore(student, alumnus),
      location: locationScore(ask, student, alumnus),
      experience: experienceScore(ask, alumnus, config),
      responsiveness: responsivenessScore(alumnus, config),
      headroom: headroomScore(alumnus),
    };
    const penalties = {
      conversationLoad: conversationLoadFactor(alumnus.activeConversations) * config.penalties.conversationLoad,
      recentLoad: (alumnus.recentRequests / maxRecent) * config.penalties.recentLoad,
    };
    const weighted = (Object.keys(config.weights) as PartKey[]).reduce((sum, key) => sum + config.weights[key] * parts[key], 0);
    const score = round(100 * clamp01(weighted - penalties.conversationLoad - penalties.recentLoad), 1);
    return { alumnus, parts, penalties, score };
  });

  ranked.sort((left, right) => right.score - left.score || (left.alumnus.id < right.alumnus.id ? -1 : 1));

  const matches: RankedMatch[] = ranked.slice(0, limit).map((entry, index) => ({
    alumniId: entry.alumnus.id,
    rank: index + 1,
    score: entry.score,
    parts: Object.fromEntries(Object.entries(entry.parts).map(([key, value]) => [key, round(value)])) as Record<PartKey, number>,
    penalties: { conversationLoad: round(entry.penalties.conversationLoad), recentLoad: round(entry.penalties.recentLoad) },
    reasons: buildReasons(ask, student, entry.alumnus, { companyFilterRelaxed }),
  }));
  return { matches, eligibleCount: eligible.length, companyFilterRelaxed };
}
