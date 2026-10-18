import { db } from "../db";
import { ROLES, type Role, type UserStatus } from "../domain/constants";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { destroyAllSessions } from "../auth/session";
import { ROLE_BY_SLUG, type RoleSlug, type SessionUser } from "../auth/types";
import type { RegisterMemberInput } from "../validation/auth";
import { termsAcceptance } from "../domain/legal";
import { recordEvent } from "./audit";
import { notify } from "./notifications";
import { findInstituteByCode, isAllowedDomain } from "./institutes";

const INVALID_CODE = "That institute code was not recognised.";

/** Safe projection of a user for admin screens. Never includes the password hash. */
const userSelect = {
  id: true,
  role: true,
  name: true,
  email: true,
  status: true,
  onboardingComplete: true,
  createdAt: true,
  lastLoginAt: true,
  studentProfile: { select: { completeness: true } },
  alumniProfile: { select: { completeness: true } },
} as const;

/**
 * Self sign-up with an institute code.
 * - Students must use an allowed email domain (otherwise they need an admin invite).
 * - Alumni wait for admin approval when the institute requires it.
 */
export async function registerMember(rawInput: RegisterMemberInput) {
  const input = { ...rawInput, email: rawInput.email.trim().toLowerCase() };
  const institute = await findInstituteByCode(input.code);
  if (!institute) throw badRequest(INVALID_CODE);
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw conflict("An account with this email already exists.");
  }

  const role: Role = ROLE_BY_SLUG[input.role];
  if (role === "STUDENT" && !isAllowedDomain(input.email, institute.allowedEmailDomains)) {
    throw forbidden("Student sign-up needs an institute email address. Ask your institute for an invite.");
  }
  const status: UserStatus = role === "ALUMNI" && institute.requireApproval ? "PENDING_APPROVAL" : "ACTIVE";

  const user = await db.user.create({
    data: {
      instituteId: institute.id,
      role,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      status,
      ...termsAcceptance(),
    },
    select: userSelect,
  });
  await recordEvent({ instituteId: institute.id, actorId: user.id, kind: "user.registered", entity: "user", entityId: user.id, payload: { role, status } });
  return user;
}

export type LoginFailure = "invalid" | "pending" | "suspended";

/**
 * Verifies credentials for a specific role login page. Wrong role and wrong password
 * give the same generic error so the page cannot be used to discover accounts.
 */
export async function authenticate(rawEmail: string, password: string, roleSlug: RoleSlug) {
  const user = await db.user.findUnique({ where: { email: rawEmail.trim().toLowerCase() } });
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk || user.status === "DELETED" || user.role !== ROLE_BY_SLUG[roleSlug]) {
    throw badRequest("Incorrect email or password.");
  }
  if (user.status === "PENDING_APPROVAL") throw forbidden("Your account is waiting for approval from your institute.");
  if (user.status === "SUSPENDED") throw forbidden("This account has been suspended. Contact your institute.");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function listInstituteUsers(admin: SessionUser, filter: { role?: Role; status?: UserStatus; q?: string } = {}) {
  const rows = await db.user.findMany({
    where: {
      instituteId: admin.instituteId,
      role: filter.role ? filter.role : { in: ROLES.filter((role) => role !== "ADMIN") },
      status: filter.status ? filter.status : { not: "DELETED" },
      ...(filter.q ? { OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { email: { contains: filter.q.toLowerCase(), mode: "insensitive" } }] } : {}),
    },
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ studentProfile, alumniProfile, ...user }) => ({ ...user, completeness: (studentProfile ?? alumniProfile)?.completeness ?? 0 }));
}

export type UserAction = "approve" | "suspend" | "reactivate";

const TRANSITIONS: Record<UserAction, { from: UserStatus[]; to: UserStatus }> = {
  approve: { from: ["PENDING_APPROVAL"], to: "ACTIVE" },
  suspend: { from: ["ACTIVE", "PENDING_APPROVAL"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "ACTIVE" },
};

/** Changes a member's status. The target must belong to the admin's own institute. */
export async function applyUserAction(admin: SessionUser, userId: string, action: UserAction) {
  if (admin.role !== "ADMIN") throw forbidden();
  const target = await db.user.findFirst({ where: { id: userId, instituteId: admin.instituteId } });
  if (!target || target.role === "ADMIN") throw notFound("User not found.");

  const { from, to } = TRANSITIONS[action];
  if (!from.includes(target.status as UserStatus)) throw conflict(`Cannot ${action} a user whose status is ${target.status}.`);

  const updated = await db.user.update({ where: { id: target.id }, data: { status: to }, select: userSelect });
  if (to === "SUSPENDED") await destroyAllSessions(target.id);
  if (action === "approve") await notify(target.id, "account_approved");
  await recordEvent({ instituteId: admin.instituteId, actorId: admin.id, kind: `user.${action}`, entity: "user", entityId: target.id });
  return updated;
}
