import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { badRequest, forbidden, notFound } from "../errors";
import { parseList, toList } from "../json";
import { alumniChecks, studentChecks, summarize, type Completeness } from "../profile/completeness";
import type {
  AlumniProfileInput,
  EducationInput,
  ExperienceInput,
  StudentProfileInput,
} from "../validation/profile";
import { recordEvent } from "./audit";
import { replaceUserSkills } from "./skills";

/** Keeps only keys whose value is not undefined (undefined means "leave unchanged"). */
function compact<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}

async function replaceExperiences(tx: Prisma.TransactionClient, userId: string, items: ExperienceInput[]) {
  await tx.experience.deleteMany({ where: { userId } });
  for (const item of items) await tx.experience.create({ data: { userId, ...item } });
}

async function replaceEducations(tx: Prisma.TransactionClient, userId: string, items: EducationInput[]) {
  await tx.education.deleteMany({ where: { userId } });
  for (const item of items) await tx.education.create({ data: { userId, ...item } });
}

const experienceSelect = { id: true, type: true, title: true, organisation: true, startDate: true, endDate: true, isCurrent: true, description: true } as const;
const educationSelect = { id: true, institution: true, degree: true, field: true, startYear: true, endYear: true, grade: true } as const;

async function loadShared(userId: string) {
  const [user, experiences, educations, userSkills, resume] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, onboardingComplete: true } }),
    db.experience.findMany({ where: { userId }, select: experienceSelect, orderBy: { createdAt: "asc" } }),
    db.education.findMany({ where: { userId }, select: educationSelect, orderBy: { createdAt: "asc" } }),
    db.userSkill.findMany({ where: { userId }, include: { skill: true }, orderBy: { skill: { name: "asc" } } }),
    db.resume.findFirst({ where: { userId }, orderBy: { uploadedAt: "desc" }, select: { id: true, fileName: true, size: true, uploadedAt: true } }),
  ]);
  return {
    user,
    experiences,
    educations,
    skills: userSkills.map((row) => ({ name: row.skill.name, level: row.level, years: row.years })),
    resume,
  };
}

export type StudentProfileView = Awaited<ReturnType<typeof getStudentProfile>>;
export type AlumniProfileView = Awaited<ReturnType<typeof getAlumniProfile>>;

export async function getStudentProfile(userId: string) {
  const shared = await loadShared(userId);
  const row = await db.studentProfile.findUnique({ where: { userId } });
  const profile = {
    enrollmentNo: row?.enrollmentNo ?? null,
    department: row?.department ?? null,
    degree: row?.degree ?? null,
    currentYear: row?.currentYear ?? null,
    graduationYear: row?.graduationYear ?? null,
    cgpa: row?.cgpa ?? null,
    city: row?.city ?? null,
    headline: row?.headline ?? null,
    bio: row?.bio ?? null,
    targetRoles: parseList(row?.targetRoles),
    targetCompanies: parseList(row?.targetCompanies),
    interestedDomains: parseList(row?.interestedDomains),
    preferredLocations: parseList(row?.preferredLocations),
    linkedinUrl: row?.linkedinUrl ?? null,
    githubUrl: row?.githubUrl ?? null,
    portfolioUrl: row?.portfolioUrl ?? null,
  };
  const completeness: Completeness = summarize(
    studentChecks({
      name: shared.user.name,
      phone: shared.user.phone,
      ...profile,
      hasResume: Boolean(shared.resume),
      skillCount: shared.skills.length,
      educationCount: shared.educations.length,
    }),
  );
  return { ...shared, profile, completeness };
}

export async function getAlumniProfile(userId: string) {
  const shared = await loadShared(userId);
  const row = await db.alumniProfile.findUnique({ where: { userId } });
  const profile = {
    department: row?.department ?? null,
    degree: row?.degree ?? null,
    graduationYear: row?.graduationYear ?? null,
    currentCompany: row?.currentCompany ?? null,
    currentTitle: row?.currentTitle ?? null,
    industry: row?.industry ?? null,
    yearsExperience: row?.yearsExperience ?? null,
    city: row?.city ?? null,
    workMode: row?.workMode ?? null,
    headline: row?.headline ?? null,
    bio: row?.bio ?? null,
    helpTypes: parseList(row?.helpTypes),
    referralCompanies: parseList(row?.referralCompanies),
    linkedinUrl: row?.linkedinUrl ?? null,
    // PRIVATE: returned only to the alumnus themselves (see lib/dto/profile.ts for what others get).
    maxActiveConnections: row?.maxActiveConnections ?? 3,
    acceptingRequests: row?.acceptingRequests ?? true,
  };
  const completeness: Completeness = summarize(
    alumniChecks({
      name: shared.user.name,
      phone: shared.user.phone,
      ...profile,
      skillCount: shared.skills.length,
    }),
  );
  return { ...shared, profile, completeness };
}

function assertRole(user: SessionUser, role: SessionUser["role"]) {
  if (user.role !== role) throw forbidden();
}

async function finishSave(
  user: SessionUser,
  completeness: Completeness,
  submit: boolean | undefined,
  kind: string,
  storePercent: () => Promise<unknown>,
) {
  await storePercent();
  if (submit) {
    if (completeness.missing.length) throw badRequest(`Please complete: ${completeness.missing.join(", ")}.`);
    if (!user.onboardingComplete) {
      await db.user.update({ where: { id: user.id }, data: { onboardingComplete: true } });
      await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: `${kind}.onboarded`, entity: "user", entityId: user.id });
    }
  }
}

/** Saves any subset of the student profile (autosave per wizard step); `submit` completes onboarding. */
export async function saveStudentProfile(user: SessionUser, input: StudentProfileInput) {
  assertRole(user, "STUDENT");
  const fields = compact({
    enrollmentNo: input.enrollmentNo,
    department: input.department,
    degree: input.degree,
    currentYear: input.currentYear,
    graduationYear: input.graduationYear,
    cgpa: input.cgpa,
    city: input.city,
    headline: input.headline,
    bio: input.bio,
    linkedinUrl: input.linkedinUrl,
    githubUrl: input.githubUrl,
    portfolioUrl: input.portfolioUrl,
    targetRoles: input.targetRoles && toList(input.targetRoles),
    targetCompanies: input.targetCompanies && toList(input.targetCompanies),
    interestedDomains: input.interestedDomains && toList(input.interestedDomains),
    preferredLocations: input.preferredLocations && toList(input.preferredLocations),
  });

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: compact({ name: input.name, phone: input.phone }) });
    await tx.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
    if (input.experiences) await replaceExperiences(tx, user.id, input.experiences);
    if (input.educations) await replaceEducations(tx, user.id, input.educations);
    if (input.skills) await replaceUserSkills(tx, user.id, input.skills);
  });

  const view = await getStudentProfile(user.id);
  await finishSave(user, view.completeness, input.submit, "student", () =>
    db.studentProfile.update({ where: { userId: user.id }, data: { completeness: view.completeness.percent } }),
  );
  return getStudentProfile(user.id);
}

export async function saveAlumniProfile(user: SessionUser, input: AlumniProfileInput) {
  assertRole(user, "ALUMNI");
  if (input.referralCompanies && input.referralCompanies.length === 0) {
    const existing = await db.alumniProfile.findUnique({ where: { userId: user.id }, select: { currentCompany: true } });
    const company = input.currentCompany !== undefined ? input.currentCompany : existing?.currentCompany;
    // Documented default: with no explicit list, an alumnus can refer people to their own company.
    if (company) input = { ...input, referralCompanies: [company] };
  }
  const fields = compact({
    department: input.department,
    degree: input.degree,
    graduationYear: input.graduationYear,
    currentCompany: input.currentCompany,
    currentTitle: input.currentTitle,
    industry: input.industry,
    yearsExperience: input.yearsExperience,
    city: input.city,
    workMode: input.workMode,
    headline: input.headline,
    bio: input.bio,
    linkedinUrl: input.linkedinUrl,
    helpTypes: input.helpTypes && toList(input.helpTypes),
    referralCompanies: input.referralCompanies && toList(input.referralCompanies),
    maxActiveConnections: input.maxActiveConnections ?? undefined,
    acceptingRequests: input.acceptingRequests,
  });

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: compact({ name: input.name, phone: input.phone }) });
    await tx.alumniProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields });
    if (input.experiences) await replaceExperiences(tx, user.id, input.experiences);
    if (input.educations) await replaceEducations(tx, user.id, input.educations);
    if (input.skills) await replaceUserSkills(tx, user.id, input.skills);
  });

  const view = await getAlumniProfile(user.id);
  await finishSave(user, view.completeness, input.submit, "alumni", () =>
    db.alumniProfile.update({ where: { userId: user.id }, data: { completeness: view.completeness.percent } }),
  );
  return getAlumniProfile(user.id);
}

/** Capacity and pause switch. Visible only to the alumnus; admin audit payloads omit the numbers. */
export async function getAlumniSettings(user: SessionUser) {
  assertRole(user, "ALUMNI");
  const row = await db.alumniProfile.findUnique({ where: { userId: user.id }, select: { maxActiveConnections: true, acceptingRequests: true } });
  if (!row) throw notFound("Finish onboarding first.");
  return row;
}

export async function updateAlumniSettings(user: SessionUser, input: { maxActiveConnections: number; acceptingRequests: boolean }) {
  assertRole(user, "ALUMNI");
  const exists = await db.alumniProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!exists) throw notFound("Finish onboarding first.");
  const row = await db.alumniProfile.update({
    where: { userId: user.id },
    data: { maxActiveConnections: input.maxActiveConnections, acceptingRequests: input.acceptingRequests },
    select: { maxActiveConnections: true, acceptingRequests: true },
  });
  await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "alumni.settings.updated", entity: "user", entityId: user.id });
  return row;
}
