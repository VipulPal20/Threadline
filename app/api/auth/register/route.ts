import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth/login";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { ROLE_BY_SLUG, homePathFor } from "@/lib/auth/types";
import { clientIp, handle, readJson } from "@/lib/http";
import { registerMember } from "@/lib/services/users";
import { registerMemberSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  hit(`register:${clientIp(request)}`, 10, HOUR_MS);
  const input = registerMemberSchema.parse(await readJson(request));
  const user = await registerMember(input);

  if (user.status === "PENDING_APPROVAL") {
    return NextResponse.json({ redirect: "/pending", status: user.status }, { status: 201 });
  }
  await startSession(request, user.id);
  return NextResponse.json({ redirect: homePathFor(ROLE_BY_SLUG[input.role]), status: user.status }, { status: 201 });
});
