import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { resolveAsk } from "@/lib/services/conversations";
import { resolveSchema } from "@/lib/validation/conversation";

export const runtime = "nodejs";

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const student = await requireApiUser("STUDENT");
  await resolveAsk(student, (await params).id, resolveSchema.parse(await readJson(request)));
  return NextResponse.json({ ok: true });
});
