/**
 * Deterministic seed for development and demos. Everything here is synthetic.
 * All seeded accounts share the demo password below; it is for local use only.
 *
 * Run with: npm run db:seed   (or npm run db:reset to wipe first)
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export const DEMO_PASSWORD = "Demo@12345";
const SEED = 20261018;

const db = new PrismaClient();

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relative), "utf8")) as T;
}

const firstNames = readJson<string[]>("data/lists/first-names.json");
const surnames = readJson<string[]>("data/lists/surnames.json");
const departments = readJson<string[]>("data/lists/departments.json");
const cities = readJson<string[]>("data/lists/cities.json");
const companies = readJson<string[]>("data/lists/companies.json");
const vocabulary = readJson<Record<string, Record<string, number>>>("data/vocab/skills-by-category.json");
const domains = Object.keys(vocabulary);

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);
const pick = <T,>(values: readonly T[]): T => values[Math.floor(random() * values.length)]!;
const list = (values: readonly string[]) => JSON.stringify(values);

function sampleSkills(domain: string, count: number): string[] {
  const pool = Object.keys(vocabulary[domain] ?? {});
  const chosen = new Set<string>();
  while (chosen.size < Math.min(count, pool.length)) chosen.add(pick(pool));
  return [...chosen];
}

const HELP_TYPES = ["referral", "mentorship", "mock_interview", "resume_review", "career_advice", "research", "funding"];
const TITLES: Record<string, string[]> = {
  "data analytics": ["Data Analyst", "Senior Data Analyst", "Analytics Manager"],
  "software engineering": ["Software Engineer", "Senior Software Engineer", "Engineering Manager"],
  "machine learning": ["ML Engineer", "Data Scientist", "Research Engineer"],
  "product management": ["Product Manager", "Senior Product Manager", "Group PM"],
  "semiconductor systems": ["VLSI Engineer", "Design Verification Engineer", "Silicon Architect"],
  research: ["Research Scientist", "Applied Researcher", "Principal Researcher"],
  entrepreneurship: ["Founder", "Co-founder", "Venture Associate"],
  design: ["Product Designer", "UX Researcher", "Design Lead"],
};

async function wipe() {
  await db.auditEvent.deleteMany();
  await db.notification.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.introRequest.deleteMany();
  await db.matchSnapshot.deleteMany();
  await db.askSkill.deleteMany();
  await db.ask.deleteMany();
  await db.userSkill.deleteMany();
  await db.resume.deleteMany();
  await db.experience.deleteMany();
  await db.education.deleteMany();
  await db.studentProfile.deleteMany();
  await db.alumniProfile.deleteMany();
  await db.passwordReset.deleteMany();
  await db.invite.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.skill.deleteMany();
  await db.institute.deleteMany();
}

async function ensureSkills(): Promise<Map<string, string>> {
  const names = new Set<string>();
  for (const skills of Object.values(vocabulary)) for (const name of Object.keys(skills)) names.add(name);
  const ids = new Map<string, string>();
  for (const name of names) {
    const skill = await db.skill.create({ data: { name } });
    ids.set(name, skill.id);
  }
  return ids;
}

interface InstituteSeed {
  name: string;
  slug: string;
  joinCode: string;
  domain: string;
  students: number;
  alumni: number;
}

async function seedInstitute(seed: InstituteSeed, skillIds: Map<string, string>, passwordHash: string) {
  const institute = await db.institute.create({
    data: {
      name: seed.name,
      slug: seed.slug,
      joinCode: seed.joinCode,
      allowedEmailDomains: list([seed.domain]),
      requireApproval: true,
    },
  });

  await db.user.create({
    data: {
      instituteId: institute.id,
      role: "ADMIN",
      email: `admin@${seed.domain}`,
      passwordHash,
      name: `${seed.name} Alumni Office`,
      status: "ACTIVE",
      onboardingComplete: true,
    },
  });

  for (let index = 1; index <= seed.students; index += 1) {
    const domain = pick(domains);
    const name = `${pick(firstNames)} ${pick(surnames)}`;
    const skills = sampleSkills(domain, 4 + Math.floor(random() * 3));
    const user = await db.user.create({
      data: {
        instituteId: institute.id,
        role: "STUDENT",
        email: `student${index}@${seed.domain}`,
        passwordHash,
        name,
        phone: `+91 90000 ${String(10000 + index)}`,
        status: "ACTIVE",
        onboardingComplete: true,
        studentProfile: {
          create: {
            enrollmentNo: `${seed.slug.toUpperCase().slice(0, 3)}${2200 + index}`,
            department: pick(departments),
            degree: "B.Tech",
            currentYear: 3 + Math.floor(random() * 2),
            graduationYear: 2027 + Math.floor(random() * 2),
            cgpa: Math.round((6.5 + random() * 3) * 10) / 10,
            city: pick(cities),
            headline: `Student interested in ${domain}`,
            bio: `Final-year student building skills in ${domain}.`,
            targetRoles: list([TITLES[domain]![0]!]),
            targetCompanies: list([pick(companies)]),
            interestedDomains: list([domain]),
            preferredLocations: list([pick(cities)]),
            completeness: 100,
          },
        },
      },
    });
    for (const skill of skills) {
      await db.userSkill.create({
        data: { userId: user.id, skillId: skillIds.get(skill)!, level: pick(["BEGINNER", "INTERMEDIATE"]) },
      });
    }
  }

  for (let index = 1; index <= seed.alumni; index += 1) {
    const domain = pick(domains);
    const name = `${pick(firstNames)} ${pick(surnames)}`;
    const company = pick(companies);
    const city = pick(cities);
    const skills = sampleSkills(domain, 4 + Math.floor(random() * 4));
    const helpTypes = HELP_TYPES.filter(() => random() > 0.4);
    if (!helpTypes.length) helpTypes.push("mentorship");
    const graduationYear = 2008 + Math.floor(random() * 15);
    const user = await db.user.create({
      data: {
        instituteId: institute.id,
        role: "ALUMNI",
        email: `alumni${index}@${seed.domain}`,
        passwordHash,
        name,
        phone: `+91 91000 ${String(10000 + index)}`,
        status: "ACTIVE",
        onboardingComplete: true,
        alumniProfile: {
          create: {
            department: pick(departments),
            degree: "B.Tech",
            graduationYear,
            currentCompany: company,
            currentTitle: pick(TITLES[domain]!),
            industry: domain,
            yearsExperience: 2026 - graduationYear,
            city,
            workMode: pick(["ONSITE", "HYBRID", "REMOTE"]),
            headline: `${domain} professional at ${company}`,
            bio: `Working in ${domain} at ${company}. Happy to help students from the institute.`,
            helpTypes: list(helpTypes),
            referralCompanies: list([company]),
            maxActiveConnections: 1 + Math.floor(random() * 5),
            acceptingRequests: random() > 0.1,
            completeness: 100,
          },
        },
      },
    });
    for (const skill of skills) {
      await db.userSkill.create({
        data: { userId: user.id, skillId: skillIds.get(skill)!, level: pick(["INTERMEDIATE", "EXPERT"]) },
      });
    }
  }
}


const CATEGORIES = ["referral", "mentorship", "mock_interview", "resume_review", "career_advice", "research", "funding"];
const OUTCOMES = ["resolved", "resolved", "resolved", "resolved", "in_progress", "declined", "expired", "open", "no_match", "cancelled"] as const;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Historical asks with believable outcomes, so the admin dashboard has something to show.
 * Written straight to the database with past dates; the app's own services are not involved.
 */
async function seedActivity(instituteId: string, count: number, skillIds: Map<string, string>) {
  const students = await db.user.findMany({ where: { instituteId, role: "STUDENT" }, select: { id: true } });
  const alumni = await db.user.findMany({ where: { instituteId, role: "ALUMNI" }, select: { id: true } });
  const now = Date.now();

  for (let index = 0; index < count; index += 1) {
    const outcome = OUTCOMES[index % OUTCOMES.length]!;
    const student = students[index % students.length]!;
    const helper = alumni[(index * 7 + 3) % alumni.length]!;
    const backup = alumni[(index * 5 + 1) % alumni.length]!;
    const domain = pick(domains);
    const category = pick(CATEGORIES);
    const skills = sampleSkills(domain, 2 + (index % 2));
    const createdAt = new Date(now - (outcome === "open" ? 1 + (index % 2) : 3 + Math.floor(random() * 38)) * DAY);
    const respondedAt = new Date(createdAt.getTime() + (1 + Math.floor(random() * 20)) * HOUR);

    const ask = await db.ask.create({
      data: {
        instituteId,
        studentId: student.id,
        category,
        title: `Help with ${domain}`,
        description: `Demo ask: looking for ${category.replace("_", " ")} help in ${domain}. Synthetic data.`,
        domain,
        status: outcome === "resolved" ? "RESOLVED" : outcome === "in_progress" ? "IN_PROGRESS" : outcome === "expired" ? "EXPIRED" : outcome === "cancelled" ? "CANCELLED" : "OPEN",
        deadline: outcome === "expired" ? new Date(createdAt.getTime() + 5 * DAY) : null,
        createdAt,
        updatedAt: createdAt,
        resolvedAt: outcome === "resolved" ? new Date(respondedAt.getTime() + (1 + Math.floor(random() * 8)) * DAY) : null,
        rating: outcome === "resolved" ? 3 + Math.floor(random() * 3) : null,
        skills: { create: skills.map((name) => ({ skillId: skillIds.get(name)!, importance: "MUST" })) },
      },
    });

    if (outcome !== "no_match" && outcome !== "cancelled") {
      await db.matchSnapshot.create({ data: { askId: ask.id, alumniId: helper.id, rank: 1, score: 60 + Math.floor(random() * 35), parts: "{}", reasons: JSON.stringify(["Demo match"]), computedAt: createdAt } });
    }
    if (outcome === "no_match" || outcome === "cancelled") continue;

    const state = outcome === "resolved" ? "CLOSED" : outcome === "in_progress" ? "ACCEPTED" : outcome === "declined" ? "DECLINED" : outcome === "expired" ? "EXPIRED" : "PENDING";
    const request = await db.introRequest.create({
      data: {
        askId: ask.id,
        studentId: student.id,
        alumniId: helper.id,
        state,
        initialMessage: "Demo request message.",
        createdAt,
        respondedAt: ["resolved", "in_progress", "declined"].includes(outcome) ? respondedAt : null,
        closedAt: outcome === "resolved" ? ask.resolvedAt : ["declined", "expired"].includes(outcome) ? respondedAt : null,
        expiresAt: new Date(createdAt.getTime() + 3 * DAY),
        declineReason: outcome === "declined" ? "Demo: too busy" : null,
      },
    });
    if (outcome === "resolved" || outcome === "in_progress") {
      const conversation = await db.conversation.create({
        data: { introRequestId: request.id, status: outcome === "resolved" ? "CLOSED" : "ACTIVE", createdAt: respondedAt, lastMessageAt: ask.resolvedAt ?? respondedAt },
      });
      await db.message.create({ data: { conversationId: conversation.id, senderId: student.id, body: "Demo opening message.", createdAt: respondedAt } });
      await db.message.create({ data: { conversationId: conversation.id, senderId: helper.id, body: "Demo reply.", createdAt: new Date(respondedAt.getTime() + HOUR) } });
    }
    if (outcome === "declined") {
      // the student tried someone else afterwards
      await db.introRequest.create({
        data: { askId: ask.id, studentId: student.id, alumniId: backup.id, state: "PENDING", initialMessage: "Demo request message.", createdAt: new Date(respondedAt.getTime() + HOUR), expiresAt: new Date(now + 2 * DAY) },
      });
    }
  }
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const skillIds = await ensureSkills();
  await seedInstitute(
    { name: "Northbridge Institute of Technology", slug: "northbridge", joinCode: "NORTH-2026", domain: "northbridge.test", students: 24, alumni: 30 },
    skillIds,
    passwordHash,
  );
  await seedInstitute(
    { name: "Lakeshore University", slug: "lakeshore", joinCode: "LAKE-2026", domain: "lakeshore.test", students: 12, alumni: 16 },
    skillIds,
    passwordHash,
  );
  const institutes = await db.institute.findMany({ select: { id: true, slug: true } });
  for (const institute of institutes) await seedActivity(institute.id, institute.slug === "northbridge" ? 28 : 10, skillIds);
  const counts = {
    institutes: await db.institute.count(),
    users: await db.user.count(),
    asks: await db.ask.count(),
    skills: await db.skill.count(),
  };
  console.log("Seeded:", counts);
  console.log(`Demo logins: admin@northbridge.test, student1@northbridge.test, alumni1@northbridge.test (password ${DEMO_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
