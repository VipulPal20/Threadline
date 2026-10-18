import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { hit, resetRateLimits } from "../lib/auth/rate-limit";
import { createSession, resolveSession } from "../lib/auth/session";
import { db } from "../lib/db";
import { completeReset, createResetLink, previewReset } from "../lib/services/password-reset";
import { getResumeFile, resumeDir } from "../lib/services/resumes";
import { applyUserAction, authenticate } from "../lib/services/users";
import { makeAlumnus, makeStudent } from "./factories";
import { PASSWORD, makeInstitute, resetDb } from "./helpers";

beforeEach(resetDb);

describe("rate limiting of busy actions", () => {
  it("allows up to the limit inside the window, then refuses, and frees up afterwards", () => {
    const now = Date.now();
    for (let call = 0; call < 3; call += 1) hit("sign-up:1.2.3.4", 3, 1000, now);
    expect(() => hit("sign-up:1.2.3.4", 3, 1000, now + 10)).toThrowError(/too often/);
    expect(() => hit("sign-up:5.6.7.8", 3, 1000, now + 10)).not.toThrow();
    expect(() => hit("sign-up:1.2.3.4", 3, 1000, now + 2000)).not.toThrow();
    resetRateLimits();
  });
});

describe("admin-issued password reset", () => {
  it("lets a locked-out member choose a new password once, and signs them out everywhere", async () => {
    const { admin, institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id, 1);
    await db.user.update({ where: { id: student.id }, data: { passwordHash: (await db.user.findUniqueOrThrow({ where: { id: admin.id } })).passwordHash, email: "kid@alpha.test" } });
    const { token } = await createSession(student.id);
    expect(await resolveSession(token)).not.toBeNull();

    const { url, email } = await createResetLink(admin, student.id);
    expect(email).toBe("kid@alpha.test");
    const resetToken = url.split("/reset/")[1]!;
    expect(JSON.stringify(await db.passwordReset.findMany())).not.toContain(resetToken);
    await expect(previewReset(resetToken)).resolves.toMatchObject({ role: "STUDENT" });

    await completeReset(resetToken, "BrandNew123");
    await expect(authenticate("kid@alpha.test", "BrandNew123", "student")).resolves.toMatchObject({ id: student.id });
    await expect(authenticate("kid@alpha.test", PASSWORD, "student")).rejects.toMatchObject({ status: 400 });
    expect(await resolveSession(token)).toBeNull();
    expect(await db.auditEvent.count({ where: { kind: "password.reset.used" } })).toBe(1);

    await expect(completeReset(resetToken, "AnotherOne456")).rejects.toMatchObject({ status: 404 });
    await expect(previewReset(resetToken)).rejects.toMatchObject({ status: 404 });
  });

  it("replaces an older link, expires after a day, and refuses people it should not reset", async () => {
    const { admin, institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id, 1);
    const first = (await createResetLink(admin, student.id)).url.split("/reset/")[1]!;
    const second = (await createResetLink(admin, student.id)).url.split("/reset/")[1]!;
    await expect(previewReset(first)).rejects.toMatchObject({ status: 404 });
    await expect(previewReset(second)).resolves.toBeTruthy();

    await db.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(previewReset(second)).rejects.toMatchObject({ status: 404 });
    await expect(completeReset(second, "BrandNew123")).rejects.toMatchObject({ status: 404 });

    const other = await makeInstitute("Beta University", "beta.test", "admin@beta.test");
    await expect(createResetLink(other.admin, student.id)).rejects.toMatchObject({ status: 404 });
    await expect(createResetLink(admin, admin.id)).rejects.toMatchObject({ status: 404 }); // admins are recovered by the operator script
    await expect(createResetLink({ ...admin, role: "STUDENT" }, student.id)).rejects.toMatchObject({ status: 403 });

    await applyUserAction(admin, student.id, "suspend");
    await expect(createResetLink(admin, student.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("résumé files stay inside their folder", () => {
  it("reads from RESUME_DIR only, even if a stored path tries to climb out of it", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const student = await makeStudent(institute.id, 1);
    await mkdir(resumeDir(), { recursive: true });
    await writeFile(path.join(resumeDir(), "ok.pdf"), "%PDF-1.4 ok");

    const good = await db.resume.create({ data: { userId: student.id, fileName: "cv.pdf", mime: "application/pdf", size: 11, storagePath: "ok.pdf" } });
    await expect(getResumeFile(student, good.id)).resolves.toMatchObject({ fileName: "cv.pdf" });

    const legacy = await db.resume.create({ data: { userId: student.id, fileName: "old.pdf", mime: "application/pdf", size: 11, storagePath: "storage/resumes/ok.pdf" } });
    await expect(getResumeFile(student, legacy.id)).resolves.toBeTruthy();

    const sneaky = await db.resume.create({ data: { userId: student.id, fileName: "x.pdf", mime: "application/pdf", size: 1, storagePath: "../../package.json" } });
    await expect(getResumeFile(student, sneaky.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("security headers", () => {
  it("send a strict policy on every page, and leave the policy off résumé PDFs only", async () => {
    const config = (await import(pathToFileURL(path.resolve("next.config.mjs")).href)).default as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };
    const rules = await config.headers();
    expect(rules).toHaveLength(2);
    const [general, csp] = rules as [(typeof rules)[number], (typeof rules)[number]];
    expect(general.source).toBe("/:path*");
    const headers = Object.fromEntries(general.headers.map((header) => [header.key, header.value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");

    const policy = csp.headers.find((header) => header.key === "Content-Security-Policy")!.value;
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(policy).toContain(directive);
    expect(policy).not.toMatch(/https?:\/\//);
    const matcher = new RegExp(`^${csp.source}$`);
    expect(matcher.test("/login")).toBe(true);
    expect(matcher.test("/api/asks")).toBe(true);
    expect(matcher.test("/api/resumes/abc")).toBe(false);
  });
});

describe("operator script for a locked-out admin", () => {
  const script = path.resolve("scripts/reset-admin-password.mjs");
  const run = (...args: string[]) => {
    try {
      return { code: 0, output: execFileSync("node", [script, ...args], { encoding: "utf8", stdio: "pipe" }) };
    } catch (error) {
      const failure = error as { status: number; stderr: string };
      return { code: failure.status, output: failure.stderr };
    }
  };

  it("sets a new password, signs the admin out everywhere and leaves a trail", async () => {
    const { admin } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const { token } = await createSession(admin.id);

    const result = run("ADMIN@alpha.test", "Recovered789");
    expect(result.code).toBe(0);
    expect(result.output).toContain("Password changed");
    await expect(authenticate("admin@alpha.test", "Recovered789", "admin")).resolves.toMatchObject({ id: admin.id });
    await expect(authenticate("admin@alpha.test", PASSWORD, "admin")).rejects.toMatchObject({ status: 400 });
    expect(await resolveSession(token)).toBeNull();
    expect(await db.auditEvent.count({ where: { kind: "admin.password.reset_by_operator" } })).toBe(1);
  });

  it("refuses weak passwords, unknown emails and non-admin accounts", async () => {
    const { institute } = await makeInstitute("Alpha Institute", "alpha.test", "admin@alpha.test");
    const alumnus = await makeAlumnus(institute.id, 1);
    expect(run("admin@alpha.test", "short1").code).toBe(1);
    expect(run("admin@alpha.test", "onlyletters").code).toBe(1);
    expect(run("nobody@alpha.test", "Recovered789").code).toBe(1);
    expect(run((await db.user.findUniqueOrThrow({ where: { id: alumnus.id } })).email, "Recovered789").code).toBe(1);
    expect(run().code).toBe(1);
  });
});
