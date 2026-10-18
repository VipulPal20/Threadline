import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getMatchesForAsk } from "@/lib/services/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const student = await requireApiUser("STUDENT");
  return NextResponse.json(await getMatchesForAsk(student, (await params).id));
});
