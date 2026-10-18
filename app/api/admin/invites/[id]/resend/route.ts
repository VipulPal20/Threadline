import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { resendInvite } from "@/lib/services/invites";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json(await resendInvite(admin, (await params).id));
});
