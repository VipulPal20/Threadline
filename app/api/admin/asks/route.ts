import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { listAdminAsks } from "@/lib/services/admin";
import { adminAskFilterSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const filter = adminAskFilterSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  return NextResponse.json(await listAdminAsks(admin, filter));
});
