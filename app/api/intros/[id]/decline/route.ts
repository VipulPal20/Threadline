import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { declineRequest } from "@/lib/services/requests";
import { declineSchema } from "@/lib/validation/request";

export const runtime = "nodejs";

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const alumnus = await requireApiUser("ALUMNI");
  const body = await readJson(request).catch(() => ({}));
  await declineRequest(alumnus, (await params).id, declineSchema.parse(body).reason);
  return NextResponse.json({ ok: true });
});
