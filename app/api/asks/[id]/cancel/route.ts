import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { cancelAsk } from "@/lib/services/asks";

export const runtime = "nodejs";

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const student = await requireApiUser("STUDENT");
  return NextResponse.json({ ask: await cancelAsk(student, (await params).id) });
});
