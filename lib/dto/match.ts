import { parseList } from "../json";
import type { PartKey } from "../matching/types";

/**
 * What a student sees for each suggested alumnus. Built from an explicit allow-list:
 * no email, no phone, no capacity or load figures, and no responsiveness or headroom scores
 * (those would let a student infer how busy someone is).
 */

const BREAKDOWN: Array<{ key: PartKey; label: string }> = [
  { key: "skills", label: "Skills" },
  { key: "roleFit", label: "Role fit" },
  { key: "text", label: "Relevance" },
  { key: "studentFit", label: "Profile fit" },
  { key: "affiliation", label: "Background" },
  { key: "experience", label: "Experience" },
  { key: "location", label: "Location" },
];

export interface MatchCardAlumnus {
  id: string;
  name: string;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  industry: string | null;
  city: string | null;
  department: string | null;
  graduationYear: number | null;
  yearsExperience: number | null;
  helpTypes: string[];
  skills: string[];
}

export interface MatchCard {
  snapshotId: string;
  rank: number;
  matchPercent: number;
  breakdown: Array<{ key: string; label: string; percent: number }>;
  reasons: string[];
  alumnus: MatchCardAlumnus;
}

export interface AlumnusCardRow {
  id: string;
  name: string;
  alumniProfile: {
    headline: string | null;
    currentTitle: string | null;
    currentCompany: string | null;
    industry: string | null;
    city: string | null;
    department: string | null;
    graduationYear: number | null;
    yearsExperience: number | null;
    helpTypes: string;
  } | null;
  skills: Array<{ skill: { name: string } }>;
}

export function toMatchCard(
  snapshot: { id: string; rank: number; score: number; parts: string; reasons: string },
  alumnus: AlumnusCardRow,
): MatchCard {
  const parts = JSON.parse(snapshot.parts) as { parts?: Partial<Record<PartKey, number>> };
  const profile = alumnus.alumniProfile;
  return {
    snapshotId: snapshot.id,
    rank: snapshot.rank,
    matchPercent: Math.round(snapshot.score),
    breakdown: BREAKDOWN.map(({ key, label }) => ({ key, label, percent: Math.round(100 * (parts.parts?.[key] ?? 0)) })),
    reasons: parseList(snapshot.reasons),
    alumnus: {
      id: alumnus.id,
      name: alumnus.name,
      headline: profile?.headline ?? null,
      currentTitle: profile?.currentTitle ?? null,
      currentCompany: profile?.currentCompany ?? null,
      industry: profile?.industry ?? null,
      city: profile?.city ?? null,
      department: profile?.department ?? null,
      graduationYear: profile?.graduationYear ?? null,
      yearsExperience: profile?.yearsExperience ?? null,
      helpTypes: parseList(profile?.helpTypes),
      skills: alumnus.skills.slice(0, 6).map((row) => row.skill.name),
    },
  };
}
