import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/current";
import { ROLES, USER_STATUSES } from "@/lib/domain/constants";
import { handle } from "@/lib/http";
import { listInstituteUsers } from "@/lib/services/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const GET = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const params = request.nextUrl.searchParams;
  const filter = querySchema.parse({
    role: params.get("role") ?? undefined,
    status: params.get("status") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  return NextResponse.json({ users: await listInstituteUsers(admin, filter) });
});
