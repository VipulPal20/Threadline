import type { AskCategory } from "../domain/constants";

/** Plain inputs for the ranker. The database layer fills these in; the ranker itself touches no database. */

export interface SkillLevelEntry {
  name: string;
  level: string;
}

export interface MatchAsk {
  id: string;
  studentId: string;
  category: AskCategory;
  title: string;
  description: string;
  domain: string | null;
  targetRole: string | null;
  targetCompany: string | null;
  location: string | null;
  workMode: string | null;
  skills: Array<{ name: string; importance: "MUST" | "NICE" }>;
}

export interface MatchStudent {
  department: string | null;
  graduationYear: number | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  targetRoles: string[];
  interestedDomains: string[];
}

export interface MatchAlumnus {
  id: string;
  name: string;
  acceptingRequests: boolean;
  helpTypes: string[];
  currentCompany: string | null;
  referralCompanies: string[];
  currentTitle: string | null;
  industry: string | null;
  yearsExperience: number | null;
  city: string | null;
  workMode: string | null;
  department: string | null;
  graduationYear: number | null;
  headline: string | null;
  bio: string | null;
  experienceText: string;
  skills: SkillLevelEntry[];

  /** PRIVATE: used only to decide eligibility and ordering; never copied into any result. */
  maxActiveConnections: number;
  /** PENDING requests plus ACCEPTED requests whose conversation is still active. */
  activeLoad: number;
  /** ACCEPTED requests whose conversation is still active. */
  activeConversations: number;
  /** Requests received in the last 7 days. */
  recentRequests: number;
  acceptedCount: number;
  decidedCount: number;
  /** Average hours to respond, null when there is no history. */
  avgResponseHours: number | null;
  /** This student asked this alumnus before and was declined within the cooldown. */
  recentlyDeclinedThisStudent: boolean;
  /** A request for this very ask already exists. */
  alreadyRequestedForAsk: boolean;
}

export type PartKey =
  | "skills"
  | "text"
  | "roleFit"
  | "studentFit"
  | "affiliation"
  | "location"
  | "experience"
  | "responsiveness"
  | "headroom";

export interface RankedMatch {
  alumniId: string;
  rank: number;
  /** 0 to 100, one decimal. */
  score: number;
  /** Each part is 0 to 1. */
  parts: Record<PartKey, number>;
  penalties: { conversationLoad: number; recentLoad: number };
  reasons: string[];
}

export interface RankResult {
  matches: RankedMatch[];
  /** How many alumni passed every hard filter. */
  eligibleCount: number;
  /** True when the target-company filter found nobody and was relaxed. */
  companyFilterRelaxed: boolean;
}
