import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { endConversation } from "@/lib/services/conversations";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  await endConversation(user, (await params).id);
  return NextResponse.json({ ok: true });
});
