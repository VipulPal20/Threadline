import { beforeEach, describe, expect, it } from "vitest";
import { passwordProblem, verifyPassword, hashPassword } from "../lib/auth/password";
import { assertNotLimited, recordFailure, resetRateLimits } from "../lib/auth/rate-limit";
import { createSession, destroySession, resolveSession } from "../lib/auth/session";
import { db } from "../lib/db";
import { acceptInvite, createInvite, previewInvite } from "../lib/services/invites";
import { applyUserAction, authenticate, listInstituteUsers } from "../lib/services/users";
import { PASSWORD, makeInstitute, makeMember, resetDb } from "./helpers";

beforeEach(resetDb);

describe("passwords", () => {
  it("rejects weak passwords and accepts a reasonable one", () => {
    expect(passwordProblem("short1")).toMatch(/8 characters/);
    expect(passwordProblem("onlyletters")).toMatch(/letter and one number/);
    expect(passwordProblem("password123")).toMatch(/common/);
    expect(passwordProblem(PASSWORD)).toBeNull();
  });

  it("hashes and verifies, and never matches when no hash exists", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong-pass1", hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, null)).toBe(false);
  });
});

describe("rate limiting", () => {
  it("blocks after five failures and recovers when the window passes", () => {
    const now = Date.now();
    for (let attempt = 0; attempt < 5; attempt += 1) recordFailure("a@b.test|1.1.1.1", 1000, now);
    expect(() => assertNotLimited("a@b.test|1.1.1.1", 5, now + 10)).toThrow(/Too many/);
    expect(() => assertNotLimited("a@b.test|1.1.1.1", 5, now + 2000)).not.toThrow();
    resetRateLimits();
  });
});

describe("sessions", () => {
  it("resolves a token to its user, stores only a hash, and ends on destroy", async () => {
    const { admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const { token } = await createSession(admin.id);
    expect((await db.session.findFirst())?.tokenHash).not.toBe(token);

    const resolved = await resolveSession(token);
    expect(resolved?.id).toBe(admin.id);
    expect(resolved).not.toHaveProperty("passwordHash");

    await destroySession(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("rejects expired sessions and suspended users", async () => {
    const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeMember(institute.joinCode, "student", "s1@alpha.test");

    const expired = await createSession(admin.id);
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveSession(expired.token)).toBeNull();

    const live = await createSession(student.id);
    expect((await resolveSession(live.token))?.id).toBe(student.id);
    await applyUserAction(admin, student.id, "suspend");
    expect(await resolveSession(live.token)).toBeNull();
  });
});

describe("registration rules", () => {
  it("lets a student with an institute email in immediately", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeMember(institute.joinCode.toLowerCase(), "student", "Kid@Mail.Alpha.test");
    expect(student.status).toBe("ACTIVE");
    expect(student.email).toBe("kid@mail.alpha.test");
  });

  it("rejects students with an outside email domain", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await expect(makeMember(institute.joinCode, "student", "kid@gmail.com")).rejects.toMatchObject({ status: 403 });
  });

  it("puts alumni in the approval queue, and approval lets them log in", async () => {
    const { institute, admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const alumnus = await makeMember(institute.joinCode, "alumni", "old@gmail.com");
    expect(alumnus.status).toBe("PENDING_APPROVAL");
    await expect(authenticate("old@gmail.com", PASSWORD, "alumni")).rejects.toMatchObject({ status: 403 });

    await applyUserAction(admin, alumnus.id, "approve");
    await expect(authenticate("old@gmail.com", PASSWORD, "alumni")).resolves.toMatchObject({ id: alumnus.id });
  });

  it("rejects an unknown institute code and duplicate emails", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await expect(makeMember("NOPE-0000", "alumni", "x@y.test")).rejects.toMatchObject({ status: 400 });
    await makeMember(institute.joinCode, "alumni", "dup@y.test");
    await expect(makeMember(institute.joinCode, "alumni", "dup@y.test")).rejects.toMatchObject({ status: 409 });
  });
});

describe("role-specific login", () => {
  it("gives the same error for a wrong role as for a wrong password", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await makeMember(institute.joinCode, "student", "s1@alpha.test");

    const wrongRole = await authenticate("s1@alpha.test", PASSWORD, "admin").catch((error) => error);
    const wrongPassword = await authenticate("s1@alpha.test", "Wrong-pass1", "student").catch((error) => error);
    const noUser = await authenticate("ghost@alpha.test", PASSWORD, "student").catch((error) => error);
    expect(wrongRole.message).toBe(wrongPassword.message);
    expect(noUser.message).toBe(wrongPassword.message);
    await expect(authenticate("s1@alpha.test", PASSWORD, "student")).resolves.toMatchObject({ role: "STUDENT" });
  });
});

describe("tenant isolation", () => {
  it("never lets one institute's admin see or change another institute's members", async () => {
    const alpha = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const beta = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    const alphaAlumnus = await makeMember(alpha.institute.joinCode, "alumni", "a@alpha-alumni.test");
    await makeMember(beta.institute.joinCode, "alumni", "b@beta-alumni.test");

    const betaView = await listInstituteUsers(beta.admin);
    expect(betaView.map((user) => user.email)).toEqual(["b@beta-alumni.test"]);

    await expect(applyUserAction(beta.admin, alphaAlumnus.id, "approve")).rejects.toMatchObject({ status: 404 });
    expect((await db.user.findUnique({ where: { id: alphaAlumnus.id } }))?.status).toBe("PENDING_APPROVAL");
  });

  it("scopes invites to the issuing institute and blocks non-admins", async () => {
    const alpha = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeMember(alpha.institute.joinCode, "student", "s1@alpha.test");
    const studentUser = { ...alpha.admin, id: student.id, role: "STUDENT" as const };
    await expect(createInvite(studentUser, { email: "x@y.test", role: "alumni" })).rejects.toMatchObject({ status: 403 });
    await expect(applyUserAction(studentUser, student.id, "suspend")).rejects.toMatchObject({ status: 403 });
  });
});

describe("invites", () => {
  it("creates a single-use link that skips approval and domain checks", async () => {
    const { admin, institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const { url } = await createInvite(admin, { email: "mentor@gmail.com", role: "alumni" });
    const token = url.split("/invite/")[1]!;

    const preview = await previewInvite(token);
    expect(preview).toMatchObject({ email: "mentor@gmail.com", role: "ALUMNI", instituteName: "Alpha Institute" });
    expect(JSON.stringify(await db.invite.findMany())).not.toContain(token);

    const user = await acceptInvite({ token, name: "Mentor Person", password: PASSWORD });
    expect(user).toMatchObject({ role: "ALUMNI", status: "ACTIVE" });
    expect((await db.user.findUnique({ where: { id: user.id } }))?.instituteId).toBe(institute.id);

    await expect(acceptInvite({ token, name: "Mentor Person", password: PASSWORD })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to invite an email that already has an account", async () => {
    const { admin, institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    await makeMember(institute.joinCode, "student", "s1@alpha.test");
    await expect(createInvite(admin, { email: "s1@alpha.test", role: "student" })).rejects.toMatchObject({ status: 409 });
  });
});
