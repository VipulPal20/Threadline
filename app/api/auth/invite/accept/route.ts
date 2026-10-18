import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth/login";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import type { Role } from "@/lib/domain/constants";
import { homePathFor } from "@/lib/auth/types";
import { clientIp, handle, readJson } from "@/lib/http";
import { acceptInvite } from "@/lib/services/invites";
import { inviteAcceptSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  hit(`invite-accept:${clientIp(request)}`, 10, HOUR_MS);
  const input = inviteAcceptSchema.parse(await readJson(request));
  const user = await acceptInvite(input);
  await startSession(request, user.id);
  return NextResponse.json({ redirect: homePathFor(user.role as Role) }, { status: 201 });
});
