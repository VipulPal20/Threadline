import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { acceptRequest } from "@/lib/services/requests";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const alumnus = await requireApiUser("ALUMNI");
  const { requestId, conversationId } = await acceptRequest(alumnus, (await params).id);
  return NextResponse.json({ id: requestId, conversationId, redirect: `/alumni/conversations/${conversationId}` });
});
