/** Enum-like value sets. SQLite has no native enums, so columns hold these strings. */

export const ROLES = ["ADMIN", "ALUMNI", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ASK_CATEGORIES = [
  "referral",
  "mentorship",
  "mock_interview",
  "resume_review",
  "career_advice",
  "research",
  "funding",
] as const;
export type AskCategory = (typeof ASK_CATEGORIES)[number];

export const ASK_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "EXPIRED", "CANCELLED"] as const;
export type AskStatus = (typeof ASK_STATUSES)[number];

export const REQUEST_STATES = ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN", "CLOSED"] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export const URGENCIES = ["LOW", "NORMAL", "HIGH"] as const;
export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
export const SKILL_IMPORTANCE = ["MUST", "NICE"] as const;
export const EXPERIENCE_TYPES = ["JOB", "INTERNSHIP", "PROJECT"] as const;

/** Business limits agreed in docs/IMPLEMENTATION_PLAN.md section 14. */
export const LIMITS = {
  /** Pending requests allowed at once per ask. */
  maxPendingPerAsk: 2,
  /** Default asks per student per calendar month (institute-configurable). */
  defaultMonthlyAskLimit: 3,
  /** Alumni with this many active conversations are hidden from rankings. */
  maxActiveConversations: 4,
  /** The ranking penalty starts here, before the alumnus is hidden. */
  softActiveConversations: 3,
  minAlumniCapacity: 1,
  maxAlumniCapacity: 10,
} as const;
