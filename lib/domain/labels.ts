import type { AskCategory } from "./constants";

/** What a category is called for people. Alumni "ways I can help" and student ask types share these. */
export const CATEGORY_LABELS: Record<AskCategory, string> = {
  referral: "Job referral",
  mentorship: "Mentorship",
  mock_interview: "Mock interview",
  resume_review: "Résumé review",
  career_advice: "Career advice",
  research: "Research guidance",
  funding: "Funding and startups",
};

export const WORK_MODE_LABELS = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" } as const;
export const URGENCY_LABELS = { LOW: "No rush", NORMAL: "Normal", HIGH: "Urgent" } as const;
export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
