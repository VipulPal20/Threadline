import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { forbidden, unauthorized } from "../errors";
import type { Role } from "../domain/constants";
import { SESSION_COOKIE, SESSION_TTL_MS, destroySession, resolveSession } from "./session";
import { homePathFor, type SessionUser } from "./types";

/** Current user from the request cookie (server components and route handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Only mark the cookie Secure when the site is served over HTTPS; otherwise a plain-http deployment could never sign in.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await destroySession(token);
  (await cookies()).delete(SESSION_COOKIE);
}

/** Server pages and layouts: redirect to the login page unless signed in with an allowed role. */
export async function requirePageUser(role: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login/${role.toLowerCase()}`);
  if (user.role !== role) redirect(homePathFor(user.role));
  return user;
}

/** API routes: throw 401 or 403 unless signed in with one of the allowed roles. */
export async function requireApiUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles.length > 0 && !roles.includes(user.role)) throw forbidden();
  return user;
}
