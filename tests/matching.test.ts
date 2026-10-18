import { describe, expect, it } from "vitest";
import { LIMITS } from "../lib/domain/constants";
import { applyHardFilters, exclusionReason } from "../lib/matching/filters";
import { experienceScore, rankAlumni, skillsScore } from "../lib/matching/rank";
import { tfidfCosine } from "../lib/matching/text";
import type { MatchAlumnus, MatchAsk, MatchStudent } from "../lib/matching/types";
import { MATCHING_CONFIG } from "../lib/matching/weights";

function alumnus(id: string, overrides: Partial<MatchAlumnus> = {}): MatchAlumnus {
  return {
    id,
    name: `Alum ${id}`,
    acceptingRequests: true,
    helpTypes: ["referral", "mentorship"],
    currentCompany: "Northstar Labs",
    referralCompanies: [],
    currentTitle: "Data Analyst",
    industry: "data analytics",
    yearsExperience: 5,
    city: "Bengaluru",
    workMode: "HYBRID",
    department: "Computer Science",
    graduationYear: 2021,
    headline: "Data analyst",
    bio: "Builds dashboards with SQL and Power BI.",
    experienceText: "",
    skills: [
      { name: "sql", level: "EXPERT" },
      { name: "power bi", level: "INTERMEDIATE" },
    ],
    maxActiveConnections: 3,
    activeLoad: 0,
    activeConversations: 0,
    recentRequests: 0,
    acceptedCount: 0,
    decidedCount: 0,
    avgResponseHours: null,
    recentlyDeclinedThisStudent: false,
    alreadyRequestedForAsk: false,
    ...overrides,
  };
}

const ask: MatchAsk = {
  id: "ask-1",
  studentId: "student-1",
  category: "referral",
  title: "Referral for data analyst roles",
  description: "I want a referral for a data analyst role using SQL and Power BI.",
  domain: "data analytics",
  targetRole: "Data Analyst",
  targetCompany: null,
  location: "Bengaluru",
  workMode: null,
  skills: [
    { name: "sql", importance: "MUST" },
    { name: "power bi", importance: "MUST" },
  ],
};

const student: MatchStudent = {
  department: "Computer Science",
  graduationYear: 2025,
  city: "Bengaluru",
  headline: "CS student",
  bio: null,
  skills: ["sql", "python"],
  targetRoles: ["Data Analyst"],
  interestedDomains: ["data analytics"],
};

describe("configuration", () => {
  it("has weights that sum to one", () => {
    const total = Object.values(MATCHING_CONFIG.weights).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 9);
  });
});

describe("hard filters", () => {
  const cases: Array<[string, Partial<MatchAlumnus>]> = [
    ["paused", { acceptingRequests: false }],
    ["help_type", { helpTypes: ["research"] }],
    ["at_capacity", { maxActiveConnections: 2, activeLoad: 2 }],
    ["conversation_cap", { maxActiveConnections: 10, activeConversations: LIMITS.maxActiveConversations, activeLoad: 4 }],
    ["already_requested", { alreadyRequestedForAsk: true }],
    ["recently_declined", { recentlyDeclinedThisStudent: true }],
  ];
  it.each(cases)("excludes an alumnus who is %s", (reason, overrides) => {
    expect(exclusionReason(ask, alumnus("x", overrides))).toBe(reason);
    expect(rankAlumni(ask, student, [alumnus("x", overrides)]).matches).toEqual([]);
  });

  it("keeps a partly loaded alumnus visible but never one at their own limit", () => {
    const partial = alumnus("a", { maxActiveConnections: 3, activeLoad: 2 });
    const full = alumnus("b", { maxActiveConnections: 3, activeLoad: 3 });
    const result = rankAlumni(ask, student, [partial, full]);
    expect(result.matches.map((match) => match.alumniId)).toEqual(["a"]);
    expect(result.eligibleCount).toBe(1);
  });

  it("restricts a referral to the target company when someone works there", () => {
    const withCompany = { ...ask, targetCompany: "Orbitcraft" };
    const insider = alumnus("insider", { currentCompany: "Orbitcraft" });
    const referrer = alumnus("referrer", { referralCompanies: ["orbitcraft"] });
    const outsider = alumnus("outsider");
    const { eligible, companyFilterRelaxed } = applyHardFilters(withCompany, [insider, referrer, outsider]);
    expect(eligible.map((item) => item.id).sort()).toEqual(["insider", "referrer"]);
    expect(companyFilterRelaxed).toBe(false);
  });

  it("relaxes the company filter when nobody qualifies and says so", () => {
    const withCompany = { ...ask, targetCompany: "Orbitcraft" };
    const result = rankAlumni(withCompany, student, [alumnus("a"), alumnus("b")]);
    expect(result.companyFilterRelaxed).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]!.reasons[0]).toMatch(/No available alumni at Orbitcraft/);
  });

  it("only applies the company filter to referrals", () => {
    const mentorship = { ...ask, category: "mentorship" as const, targetCompany: "Orbitcraft" };
    expect(applyHardFilters(mentorship, [alumnus("a")]).eligible).toHaveLength(1);
  });
});

describe("scoring", () => {
  it("rewards more of the needed skills at a higher level", () => {
    const strong = alumnus("strong", { skills: [{ name: "sql", level: "EXPERT" }, { name: "power bi", level: "EXPERT" }] });
    const partial = alumnus("partial", { skills: [{ name: "sql", level: "BEGINNER" }] });
    const none = alumnus("none", { skills: [{ name: "welding", level: "EXPERT" }] });
    expect(skillsScore(ask, strong, MATCHING_CONFIG)).toBe(1);
    expect(skillsScore(ask, partial, MATCHING_CONFIG)).toBeCloseTo(0.25);
    expect(skillsScore(ask, none, MATCHING_CONFIG)).toBe(0);
    const order = rankAlumni(ask, student, [none, partial, strong]).matches.map((match) => match.alumniId);
    expect(order).toEqual(["strong", "partial", "none"]);
  });

  it("counts must-have skills double", () => {
    const mixed: MatchAsk = { ...ask, skills: [{ name: "sql", importance: "MUST" }, { name: "excel", importance: "NICE" }] };
    const hasMust = alumnus("m", { skills: [{ name: "sql", level: "EXPERT" }] });
    const hasNice = alumnus("n", { skills: [{ name: "excel", level: "EXPERT" }] });
    expect(skillsScore(mixed, hasMust, MATCHING_CONFIG)).toBeGreaterThan(skillsScore(mixed, hasNice, MATCHING_CONFIG));
  });

  it("normalises skill aliases when comparing", () => {
    const aliased = alumnus("a", { skills: [{ name: "PowerBI", level: "EXPERT" }, { name: "SQL", level: "EXPERT" }] });
    expect(skillsScore(ask, aliased, MATCHING_CONFIG)).toBe(1);
  });

  it("scores experience inside the ideal range as 1 and fades outside it", () => {
    expect(experienceScore(ask, alumnus("a", { yearsExperience: 5 }), MATCHING_CONFIG)).toBe(1);
    expect(experienceScore(ask, alumnus("b", { yearsExperience: 0 }), MATCHING_CONFIG)).toBeCloseTo(0.7);
    expect(experienceScore(ask, alumnus("c", { yearsExperience: null }), MATCHING_CONFIG)).toBe(0.5);
  });

  it("scores textually closer profiles higher", () => {
    const [close, far] = tfidfCosine("sql dashboards for analytics", ["builds sql dashboards and analytics", "welding and fabrication of steel"]);
    expect(close!).toBeGreaterThan(far!);
    expect(far!).toBe(0);
  });

  it("penalises an alumnus nearing the conversation cap", () => {
    const idle = alumnus("idle");
    const busy = alumnus("busy", { maxActiveConnections: 10, activeLoad: LIMITS.softActiveConversations, activeConversations: LIMITS.softActiveConversations });
    const result = rankAlumni(ask, student, [idle, busy]);
    const byId = Object.fromEntries(result.matches.map((match) => [match.alumniId, match]));
    expect(byId.busy!.penalties.conversationLoad).toBeGreaterThan(0);
    expect(byId.idle!.penalties.conversationLoad).toBe(0);
    expect(byId.idle!.score).toBeGreaterThan(byId.busy!.score);
  });

  it("spreads requests: more recent requests lower the score a little", () => {
    const quiet = alumnus("quiet");
    const swamped = alumnus("swamped", { recentRequests: 6 });
    const result = rankAlumni(ask, student, [quiet, swamped]);
    expect(result.matches[0]!.alumniId).toBe("quiet");
  });

  it("keeps scores between 0 and 100", () => {
    for (const match of rankAlumni(ask, student, [alumnus("a"), alumnus("b", { skills: [] })]).matches) {
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("ranking behaviour", () => {
  const pool = ["e", "c", "a", "d", "b"].map((id) => alumnus(id));

  it("returns the same top three on every run", () => {
    const first = rankAlumni(ask, student, pool);
    expect(rankAlumni(ask, student, pool)).toEqual(first);
    expect(rankAlumni(ask, student, [...pool].reverse())).toEqual(first);
    expect(first.matches).toHaveLength(3);
    expect(first.matches.map((match) => match.rank)).toEqual([1, 2, 3]);
  });

  it("breaks exact ties by alumnus id", () => {
    expect(rankAlumni(ask, student, pool).matches.map((match) => match.alumniId)).toEqual(["a", "b", "c"]);
  });

  it("never copies private load figures into the result", () => {
    const json = JSON.stringify(rankAlumni(ask, student, [alumnus("a", { maxActiveConnections: 7, activeLoad: 1 })]));
    for (const secret of ["maxActiveConnections", "activeLoad", "activeConversations", "acceptingRequests"]) expect(json).not.toContain(secret);
  });

  it("explains each match only with facts from the profiles", () => {
    const [match] = rankAlumni({ ...ask, targetCompany: "Northstar Labs" }, student, [alumnus("a")]).matches;
    expect(match!.reasons).toEqual(
      expect.arrayContaining(["Matches 2 of your 2 skills: sql, power bi", "Works at Northstar Labs", "Works as Data Analyst, close to your target role"]),
    );
    expect(match!.reasons.length).toBeLessThanOrEqual(4);
  });

  it("returns nothing when nobody is eligible", () => {
    expect(rankAlumni(ask, student, [])).toEqual({ matches: [], eligibleCount: 0, companyFilterRelaxed: false });
  });
});
