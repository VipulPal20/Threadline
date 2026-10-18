import { NextResponse } from "next/server";
import { assertNotLimited, clearFailures, recordFailure } from "@/lib/auth/rate-limit";
import { startSession } from "@/lib/auth/login";
import { ROLE_BY_SLUG, homePathFor } from "@/lib/auth/types";
import { recordEvent } from "@/lib/services/audit";
import { ApiError } from "@/lib/errors";
import { clientIp, handle, readJson } from "@/lib/http";
import { authenticate } from "@/lib/services/users";
import { loginSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

const ACCOUNT_MAX_FAILURES = 25;

export const POST = handle(async (request) => {
  const input = loginSchema.parse(await readJson(request));
  const key = `${input.email}|${clientIp(request)}`;
  // A second bucket on the email alone: X-Forwarded-For is only as trustworthy as the proxy in front, so an attacker
  // who changes it must still be stopped from guessing one account's password without end.
  const accountKey = `account:${input.email}`;
  assertNotLimited(key);
  assertNotLimited(accountKey, ACCOUNT_MAX_FAILURES);

  try {
    const user = await authenticate(input.email, input.password, input.role);
    clearFailures(key);
    clearFailures(accountKey);
    await startSession(request, user.id);
    await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "auth.login", entity: "user", entityId: user.id });
    return NextResponse.json({ redirect: homePathFor(ROLE_BY_SLUG[input.role]) });
  } catch (error) {
    // Only credential failures count toward the limit; a pending or suspended account is not an attack.
    if (error instanceof ApiError && error.status === 400) {
      recordFailure(key);
      recordFailure(accountKey);
    }
    throw error;
  }
});
