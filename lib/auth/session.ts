import { db } from "../db";
import type { Role, UserStatus } from "../domain/constants";
import { hashToken, randomToken } from "./tokens";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "cg_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 200) ?? null,
    },
  });
  return { token, expiresAt };
}

/** Resolves a cookie token to its user, or null when missing, expired, or the account is not ACTIVE. */
export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;

  // Sliding expiry: extend at most once a day to avoid a write on every request.
  if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - SLIDE_AFTER_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
      .catch(() => undefined);
  }

  const user = session.user;
  return {
    id: user.id,
    instituteId: user.instituteId,
    role: user.role as Role,
    status: user.status as UserStatus,
    name: user.name,
    email: user.email,
    onboardingComplete: user.onboardingComplete,
  };
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Ends every session for a user, for example when an admin suspends them. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
