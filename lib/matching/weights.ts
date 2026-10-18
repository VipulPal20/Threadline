import raw from "./weights.json";

export interface MatchingConfig {
  weights: Record<WeightKey, number>;
  penalties: { conversationLoad: number; recentLoad: number };
  skillLevelCredit: Record<string, number>;
  mustSkillWeight: number;
  niceSkillWeight: number;
  declineCooldownDays: number;
  responsivenessPrior: { acceptRate: number; weight: number };
  experienceRanges: Record<string, [number, number]>;
}

export type WeightKey =
  | "skills"
  | "text"
  | "roleFit"
  | "studentFit"
  | "affiliation"
  | "location"
  | "experience"
  | "responsiveness"
  | "headroom";

/** Committed, fixed weights. Nothing tunes ranking at runtime, so the same ask always ranks the same. */
export const MATCHING_CONFIG: MatchingConfig = Object.freeze(raw as unknown as MatchingConfig);

const total = Object.values(MATCHING_CONFIG.weights).reduce((sum, value) => sum + value, 0);
if (Math.abs(total - 1) > 1e-9) throw new Error(`Matching weights must sum to 1 (got ${total}).`);
