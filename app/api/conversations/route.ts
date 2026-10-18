import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { listConversations } from "@/lib/services/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  return NextResponse.json({ conversations: await listConversations(user) });
});
