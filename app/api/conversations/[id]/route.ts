import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getConversation } from "@/lib/services/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  return NextResponse.json(await getConversation(user, (await params).id));
});
