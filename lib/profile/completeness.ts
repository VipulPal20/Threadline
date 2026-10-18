export interface Check {
  key: string;
  label: string;
  /** Required checks must pass before onboarding can be submitted. */
  required: boolean;
  done: boolean;
}

export interface Completeness {
  percent: number;
  /** Labels of required checks that are not done yet. */
  missing: string[];
}

export function summarize(checks: readonly Check[]): Completeness {
  const done = checks.filter((check) => check.done).length;
  return {
    percent: checks.length ? Math.round((100 * done) / checks.length) : 0,
    missing: checks.filter((check) => check.required && !check.done).map((check) => check.label),
  };
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

export interface StudentSnapshot {
  name: string;
  phone: string | null;
  enrollmentNo: string | null;
  department: string | null;
  degree: string | null;
  currentYear: number | null;
  graduationYear: number | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  targetRoles: string[];
  targetCompanies: string[];
  interestedDomains: string[];
  linkedinUrl: string | null;
  hasResume: boolean;
  skillCount: number;
  educationCount: number;
}

export function studentChecks(s: StudentSnapshot): Check[] {
  return [
    { key: "name", label: "full name", required: true, done: filled(s.name) },
    { key: "department", label: "department", required: true, done: filled(s.department) },
    { key: "degree", label: "degree", required: true, done: filled(s.degree) },
    { key: "currentYear", label: "current year", required: true, done: s.currentYear != null },
    { key: "graduationYear", label: "graduation year", required: true, done: s.graduationYear != null },
    { key: "city", label: "city", required: true, done: filled(s.city) },
    { key: "resume", label: "résumé upload", required: true, done: s.hasResume },
    { key: "skills", label: "at least 3 skills", required: true, done: s.skillCount >= 3 },
    { key: "targetRoles", label: "at least one target role", required: true, done: s.targetRoles.length >= 1 },
    { key: "phone", label: "phone", required: false, done: filled(s.phone) },
    { key: "enrollmentNo", label: "enrollment number", required: false, done: filled(s.enrollmentNo) },
    { key: "headline", label: "headline", required: false, done: filled(s.headline) },
    { key: "bio", label: "about you", required: false, done: filled(s.bio) },
    { key: "education", label: "education history", required: false, done: s.educationCount >= 1 },
    { key: "targetCompanies", label: "target companies", required: false, done: s.targetCompanies.length >= 1 },
    { key: "interestedDomains", label: "interested domains", required: false, done: s.interestedDomains.length >= 1 },
    { key: "linkedinUrl", label: "LinkedIn link", required: false, done: filled(s.linkedinUrl) },
  ];
}

export interface AlumniSnapshot {
  name: string;
  phone: string | null;
  department: string | null;
  degree: string | null;
  graduationYear: number | null;
  currentCompany: string | null;
  currentTitle: string | null;
  industry: string | null;
  yearsExperience: number | null;
  city: string | null;
  workMode: string | null;
  headline: string | null;
  bio: string | null;
  helpTypes: string[];
  linkedinUrl: string | null;
  skillCount: number;
}

export function alumniChecks(a: AlumniSnapshot): Check[] {
  return [
    { key: "name", label: "full name", required: true, done: filled(a.name) },
    { key: "department", label: "department", required: true, done: filled(a.department) },
    { key: "graduationYear", label: "graduation year", required: true, done: a.graduationYear != null },
    { key: "currentCompany", label: "current company", required: true, done: filled(a.currentCompany) },
    { key: "currentTitle", label: "current job title", required: true, done: filled(a.currentTitle) },
    { key: "industry", label: "industry", required: true, done: filled(a.industry) },
    { key: "yearsExperience", label: "years of experience", required: true, done: a.yearsExperience != null },
    { key: "city", label: "city", required: true, done: filled(a.city) },
    { key: "helpTypes", label: "at least one way you can help", required: true, done: a.helpTypes.length >= 1 },
    { key: "skills", label: "at least 3 skills", required: true, done: a.skillCount >= 3 },
    { key: "phone", label: "phone", required: false, done: filled(a.phone) },
    { key: "degree", label: "degree", required: false, done: filled(a.degree) },
    { key: "workMode", label: "work mode", required: false, done: filled(a.workMode) },
    { key: "headline", label: "headline", required: false, done: filled(a.headline) },
    { key: "bio", label: "about you", required: false, done: filled(a.bio) },
    { key: "linkedinUrl", label: "LinkedIn link", required: false, done: filled(a.linkedinUrl) },
  ];
}
