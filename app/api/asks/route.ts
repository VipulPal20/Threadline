import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { askQuota, createAsk, listAsks } from "@/lib/services/asks";
import { askSchema } from "@/lib/validation/ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const student = await requireApiUser("STUDENT");
  return NextResponse.json({ asks: await listAsks(student), quota: await askQuota(student) });
});

export const POST = handle(async (request) => {
  const student = await requireApiUser("STUDENT");
  const ask = await createAsk(student, askSchema.parse(await readJson(request)));
  return NextResponse.json({ id: ask.id, redirect: `/student/asks/${ask.id}` }, { status: 201 });
});
