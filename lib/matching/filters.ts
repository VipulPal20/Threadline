import { LIMITS } from "../domain/constants";
import { MATCHING_CONFIG } from "./weights";
import { sameText } from "./text";
import type { MatchAlumnus, MatchAsk } from "./types";

export type Exclusion =
  | "paused"
  | "help_type"
  | "at_capacity"
  | "conversation_cap"
  | "already_requested"
  | "recently_declined";

/**
 * Hard filters, in the documented order. An alumnus failing any of these is never shown.
 * (Institute, role, active status and finished onboarding are enforced when candidates are loaded.)
 */
export function exclusionReason(ask: MatchAsk, alumnus: MatchAlumnus): Exclusion | null {
  if (!alumnus.acceptingRequests) return "paused";
  if (!alumnus.helpTypes.includes(ask.category)) return "help_type";
  if (alumnus.activeLoad >= alumnus.maxActiveConnections) return "at_capacity";
  if (alumnus.activeConversations >= LIMITS.maxActiveConversations) return "conversation_cap";
  if (alumnus.alreadyRequestedForAsk) return "already_requested";
  if (alumnus.recentlyDeclinedThisStudent) return "recently_declined";
  return null;
}

export function targetCompanyApplies(ask: MatchAsk): boolean {
  return ask.category === "referral" && Boolean(ask.targetCompany?.trim());
}

export function worksAtTargetCompany(ask: MatchAsk, alumnus: MatchAlumnus): boolean {
  return (
    targetCompanyApplies(ask) &&
    (sameText(alumnus.currentCompany, ask.targetCompany) || alumnus.referralCompanies.some((company) => sameText(company, ask.targetCompany)))
  );
}

export function applyHardFilters(
  ask: MatchAsk,
  alumni: readonly MatchAlumnus[],
): { eligible: MatchAlumnus[]; companyFilterRelaxed: boolean } {
  const passing = alumni.filter((alumnus) => exclusionReason(ask, alumnus) === null);
  if (!targetCompanyApplies(ask)) return { eligible: passing, companyFilterRelaxed: false };

  const atCompany = passing.filter((alumnus) => worksAtTargetCompany(ask, alumnus));
  if (atCompany.length > 0) return { eligible: atCompany, companyFilterRelaxed: false };
  // Nobody at the target company can help right now: keep everyone else and say so.
  return { eligible: passing, companyFilterRelaxed: passing.length > 0 };
}

export { MATCHING_CONFIG };
