import type { NextRequest } from "next/server";
import { clientIp } from "../http";
import { setSessionCookie } from "./current";
import { createSession } from "./session";

/** Creates a session row and sets the cookie on the current response. */
export async function startSession(request: NextRequest, userId: string): Promise<void> {
  const { token } = await createSession(userId, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  await setSessionCookie(token);
}
