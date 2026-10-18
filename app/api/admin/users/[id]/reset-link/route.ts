import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { createResetLink } from "@/lib/services/password-reset";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json(await createResetLink(admin, (await params).id), { status: 201 });
});
