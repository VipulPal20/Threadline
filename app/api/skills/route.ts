import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { searchSkills } from "@/lib/services/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (request) => {
  await requireApiUser();
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ skills: await searchSkills(q.slice(0, 40)) });
});
