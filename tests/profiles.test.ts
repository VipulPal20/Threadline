import { beforeEach, describe, expect, it } from "vitest";
import { resumeFallback } from "../lib/ai/fallbacks";
import { containsContactDetails, redactContacts } from "../lib/ai/redact";
import { extractResumeDraft, sanitizeResumeText } from "../lib/ai/resume";
import type { SessionUser } from "../lib/auth/types";
import { db } from "../lib/db";
import { publicAlumniProfile, publicStudentProfile } from "../lib/dto/profile";
import { normalizeSkill, normalizeSkills } from "../lib/matching/skills-normalize";
import {
  getAlumniProfile,
  getAlumniSettings,
  getStudentProfile,
  saveAlumniProfile,
  saveStudentProfile,
  updateAlumniSettings,
} from "../lib/services/profiles";
import { searchSkills } from "../lib/services/skills";
import { alumniProfileSchema, alumniSettingsSchema, studentProfileSchema } from "../lib/validation/profile";
import { makeInstitute, makeMember, resetDb } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
  const studentRow = await makeMember(institute.joinCode, "student", "s1@alpha.test");
  const alumniRow = await makeMember(institute.joinCode, "alumni", "a1@elsewhere.test");
  await db.user.update({ where: { id: alumniRow.id }, data: { status: "ACTIVE" } });
  const base = { instituteId: institute.id, status: "ACTIVE" as const, onboardingComplete: false };
  const student: SessionUser = { ...base, id: studentRow.id, role: "STUDENT", name: "Test Person", email: "s1@alpha.test" };
  const alumnus: SessionUser = { ...base, id: alumniRow.id, role: "ALUMNI", name: "Test Person", email: "a1@elsewhere.test" };
  return { institute, admin, student, alumnus };
}

const studentComplete = studentProfileSchema.parse({
  name: "Asha Rao",
  phone: "+91 90000 00001",
  department: "Computer Science",
  degree: "B.Tech",
  currentYear: 4,
  graduationYear: 2027,
  city: "Bengaluru",
  targetRoles: ["Data Analyst"],
  skills: [{ name: "SQL" }, { name: "Power BI" }, { name: "python" }],
});

describe("skill normalisation", () => {
  it("folds aliases, trims and de-duplicates", () => {
    expect(normalizeSkill("  JS ")).toBe("javascript");
    expect(normalizeSkill("PowerBI")).toBe("power bi");
    expect(normalizeSkills(["SQL", "sql ", "ML", "machine learning"])).toEqual(["sql", "machine learning"]);
  });
});

describe("profile validation", () => {
  it("rejects bad links, out-of-range numbers and unknown help types", () => {
    expect(() => studentProfileSchema.parse({ githubUrl: "not a url" })).toThrow(/https/);
    expect(() => studentProfileSchema.parse({ cgpa: 11 })).toThrow(/10/);
    expect(() => alumniProfileSchema.parse({ helpTypes: ["magic"] })).toThrow();
    expect(() => alumniSettingsSchema.parse({ maxActiveConnections: 0, acceptingRequests: true })).toThrow(/at least/);
    expect(() => alumniSettingsSchema.parse({ maxActiveConnections: 11, acceptingRequests: true })).toThrow(/at most/);
  });
});

describe("student onboarding", () => {
  it("autosaves partial steps without completing onboarding", async () => {
    const { student } = await setup();
    const view = await saveStudentProfile(student, studentProfileSchema.parse({ department: "Mechanical", city: "Pune" }));
    expect(view.profile.city).toBe("Pune");
    expect(view.completeness.percent).toBeGreaterThan(0);
    expect((await db.user.findUnique({ where: { id: student.id } }))?.onboardingComplete).toBe(false);
  });

  it("blocks submit until required fields and a résumé exist, then completes", async () => {
    const { student } = await setup();
    await expect(saveStudentProfile(student, { ...studentComplete, submit: true })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("résumé upload"),
    });
    expect((await db.user.findUnique({ where: { id: student.id } }))?.onboardingComplete).toBe(false);
    // the data from the failed submit is still saved
    expect((await getStudentProfile(student.id)).profile.city).toBe("Bengaluru");

    await db.resume.create({ data: { userId: student.id, fileName: "cv.pdf", mime: "application/pdf", size: 10, storagePath: "x" } });
    const done = await saveStudentProfile(student, { ...studentComplete, submit: true });
    expect(done.completeness.missing).toEqual([]);
    expect((await db.user.findUnique({ where: { id: student.id } }))?.onboardingComplete).toBe(true);
  });

  it("stores normalised, unique skills and adds them to the shared vocabulary", async () => {
    const { student } = await setup();
    const view = await saveStudentProfile(student, studentProfileSchema.parse({ skills: [{ name: "PowerBI" }, { name: "power bi" }, { name: "JS", level: "EXPERT" }] }));
    expect(view.skills.map((skill) => skill.name).sort()).toEqual(["javascript", "power bi"]);
    expect(await searchSkills("java")).toContain("javascript");
  });

  it("only students can save a student profile", async () => {
    const { alumnus } = await setup();
    await expect(saveStudentProfile(alumnus, studentProfileSchema.parse({ city: "X" }))).rejects.toMatchObject({ status: 403 });
  });
});

describe("alumni onboarding, capacity and privacy", () => {
  const alumniComplete = alumniProfileSchema.parse({
    department: "Electronics",
    graduationYear: 2018,
    currentCompany: "Northstar Labs",
    currentTitle: "Data Analyst",
    industry: "data analytics",
    yearsExperience: 7,
    city: "Bengaluru",
    helpTypes: ["referral", "mentorship"],
    referralCompanies: [],
    maxActiveConnections: 2,
    skills: [{ name: "sql" }, { name: "python" }, { name: "excel" }],
  });

  it("completes onboarding and defaults referral companies to the current company", async () => {
    const { alumnus } = await setup();
    const view = await saveAlumniProfile(alumnus, { ...alumniComplete, submit: true });
    expect(view.completeness.missing).toEqual([]);
    expect(view.profile.referralCompanies).toEqual(["Northstar Labs"]);
    expect((await db.user.findUnique({ where: { id: alumnus.id } }))?.onboardingComplete).toBe(true);
  });

  it("lets only the owner read or change capacity, and keeps it out of every public projection", async () => {
    const { alumnus, student, admin } = await setup();
    const view = await saveAlumniProfile(alumnus, { ...alumniComplete, submit: true });
    expect(view.profile.maxActiveConnections).toBe(2);

    await updateAlumniSettings(alumnus, { maxActiveConnections: 5, acceptingRequests: false });
    expect(await getAlumniSettings(alumnus)).toEqual({ maxActiveConnections: 5, acceptingRequests: false });
    await expect(getAlumniSettings(student)).rejects.toMatchObject({ status: 403 });
    await expect(updateAlumniSettings(admin, { maxActiveConnections: 1, acceptingRequests: true })).rejects.toMatchObject({ status: 403 });

    const publicJson = JSON.stringify(publicAlumniProfile(await getAlumniProfile(alumnus.id)));
    for (const secret of ["maxActiveConnections", "acceptingRequests", "email", "phone", "passwordHash"]) {
      expect(publicJson).not.toContain(secret);
    }
    // and capacity numbers never reach the admin audit trail
    const events = JSON.stringify(await db.auditEvent.findMany());
    expect(events).not.toContain("maxActiveConnections");
  });

  it("does not leak contact details through the student public projection", async () => {
    const { student } = await setup();
    await saveStudentProfile(student, studentProfileSchema.parse({ phone: "+91 90000 00001", city: "Pune" }));
    const publicJson = JSON.stringify(publicStudentProfile(await getStudentProfile(student.id)));
    expect(publicJson).not.toContain("90000");
    expect(publicJson).not.toContain("s1@alpha.test");
  });
});

describe("résumé reading", () => {
  const sample = `Asha Rao
Data Analyst Intern at Northstar Labs 2024
B.Tech Computer Science, Example Institute 2023 - 2027
Skills: SQL, Power BI, Python and ML
Reach me at asha@example.com or +91 98765 43210, https://linkedin.com/in/asha`;

  it("redacts contact details before anything is stored or sent", () => {
    const clean = sanitizeResumeText(sample);
    expect(containsContactDetails(sample)).toBe(true);
    expect(containsContactDetails(clean)).toBe(false);
    expect(redactContacts("mail me a@b.co")).toContain("[email removed]");
  });

  it("falls back to a local reader when Gemini is not configured", async () => {
    const { student } = await setup();
    delete process.env.GEMINI_API_KEY;
    const { draft, usedFallback } = await extractResumeDraft(student, sanitizeResumeText(sample));
    expect(usedFallback).toBe(true);
    expect(draft.skills).toEqual(expect.arrayContaining(["sql", "power bi", "python"]));
    expect(draft).toEqual(resumeFallback(sanitizeResumeText(sample)));
    expect(draft.roles[0]?.type).toBe("INTERNSHIP");
    expect(draft.education[0]?.endYear).toBe(2027);
  });
});
