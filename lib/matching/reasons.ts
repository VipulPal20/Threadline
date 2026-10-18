import { normalizeSkill } from "./skills-normalize";
import { sameText, tokenOverlap } from "./text";
import { worksAtTargetCompany } from "./filters";
import type { MatchAlumnus, MatchAsk, MatchStudent } from "./types";

const MAX_REASONS = 4;

/**
 * Reasons come from fixed sentence templates filled with real profile data. No language model is
 * involved, so every reason can be checked against the two profiles and the ask.
 */
export function buildReasons(
  ask: MatchAsk,
  student: MatchStudent,
  alumnus: MatchAlumnus,
  options: { companyFilterRelaxed: boolean },
): string[] {
  const reasons: string[] = [];

  if (options.companyFilterRelaxed && ask.targetCompany?.trim()) {
    reasons.push(`No available alumni at ${ask.targetCompany.trim()}, so these are the closest matches`);
  }

  const alumniSkills = new Set(alumnus.skills.map((skill) => normalizeSkill(skill.name)));
  const shared = ask.skills.filter((skill) => alumniSkills.has(normalizeSkill(skill.name)));
  if (shared.length > 0) {
    const names = shared.slice(0, 3).map((skill) => skill.name);
    reasons.push(`Matches ${shared.length} of your ${ask.skills.length} skills: ${names.join(", ")}`);
  }

  if (worksAtTargetCompany(ask, alumnus)) {
    reasons.push(
      sameText(alumnus.currentCompany, ask.targetCompany) ? `Works at ${alumnus.currentCompany}` : `Can refer people at ${ask.targetCompany}`,
    );
  }

  if (alumnus.currentTitle && ask.targetRole && tokenOverlap(alumnus.currentTitle, ask.targetRole) >= 0.5) {
    reasons.push(`Works as ${alumnus.currentTitle}, close to your target role`);
  }

  if (alumnus.industry && ask.domain && tokenOverlap(alumnus.industry, ask.domain) > 0) {
    reasons.push(`Works in ${alumnus.industry}`);
  }

  if (student.department && sameText(student.department, alumnus.department)) {
    reasons.push(`Same department: ${alumnus.department}`);
  } else if (student.graduationYear != null && alumnus.graduationYear != null && Math.abs(student.graduationYear - alumnus.graduationYear) <= 3) {
    reasons.push(`Batch of ${alumnus.graduationYear}, close to yours`);
  }

  const askCity = ask.location ?? student.city;
  if (askCity && sameText(askCity, alumnus.city)) reasons.push(`Based in ${alumnus.city}`);

  return reasons.length ? reasons.slice(0, MAX_REASONS) : ["Closest profile match among alumni who can help with this"];
}
