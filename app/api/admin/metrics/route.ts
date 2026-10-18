import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { parseRange } from "@/lib/metrics/stats";
import { getMetrics } from "@/lib/services/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const params = request.nextUrl.searchParams;
  return NextResponse.json(await getMetrics(admin, parseRange(params.get("from"), params.get("to"))));
});
