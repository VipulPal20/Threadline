import type { SessionUser } from "../lib/auth/types";
import { db } from "../lib/db";
import { askSchema, type AskInput } from "../lib/validation/ask";
import { PASSWORD } from "./helpers";

export function toSession(row: { id: string; instituteId: string; role: string; name: string; email: string }): SessionUser {
  return { id: row.id, instituteId: row.instituteId, role: row.role as SessionUser["role"], status: "ACTIVE", name: row.name, email: row.email, onboardingComplete: true };
}

export async function makeStudent(instituteId: string, n = 1) {
  const row = await db.user.create({
    data: {
      instituteId,
      role: "STUDENT",
      email: `student${n}-${instituteId.slice(-4)}@x.test`,
      passwordHash: PASSWORD,
      name: `Student ${n}`,
      onboardingComplete: true,
      studentProfile: { create: { department: "Computer Science", graduationYear: 2026, city: "Bengaluru", targetRoles: '["Data Analyst"]', interestedDomains: '["data analytics"]' } },
    },
  });
  return toSession(row);
}

export async function makeAlumnus(instituteId: string, n: number, overrides: { maxActiveConnections?: number; acceptingRequests?: boolean; helpTypes?: string[]; company?: string; skills?: string[] } = {}) {
  const skills = overrides.skills ?? ["sql", "power bi"];
  const row = await db.user.create({
    data: {
      instituteId,
      role: "ALUMNI",
      email: `alum${n}-${instituteId.slice(-4)}@x.test`,
      phone: `+91 99999 0000${n}`,
      passwordHash: PASSWORD,
      name: `Alumnus ${n}`,
      onboardingComplete: true,
      alumniProfile: {
        create: {
          department: "Computer Science",
          graduationYear: 2020,
          currentCompany: overrides.company ?? "Northstar Labs",
          currentTitle: "Data Analyst",
          industry: "data analytics",
          yearsExperience: 5,
          city: "Bengaluru",
          headline: "Data analyst",
          helpTypes: JSON.stringify(overrides.helpTypes ?? ["referral", "mentorship"]),
          maxActiveConnections: overrides.maxActiveConnections ?? 3,
          acceptingRequests: overrides.acceptingRequests ?? true,
        },
      },
    },
  });
  for (const name of skills) {
    const skill = await db.skill.upsert({ where: { name }, create: { name }, update: {} });
    await db.userSkill.create({ data: { userId: row.id, skillId: skill.id, level: "EXPERT" } });
  }
  return toSession(row);
}

export const validAsk = (overrides: Record<string, unknown> = {}): AskInput =>
  askSchema.parse({
    category: "mentorship",
    title: "Help with data analytics",
    description: "I want guidance on becoming a data analyst and building a portfolio.",
    skills: [{ name: "SQL" }, { name: "Power BI", importance: "NICE" }],
    ...overrides,
  });
