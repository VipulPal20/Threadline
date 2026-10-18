import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { withdrawRequest } from "@/lib/services/requests";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const student = await requireApiUser("STUDENT");
  await withdrawRequest(student, (await params).id);
  return NextResponse.json({ ok: true });
});
