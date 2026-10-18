import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { createInvite, listInvites } from "@/lib/services/invites";
import { inviteCreateSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json({ invites: await listInvites(admin) });
});

export const POST = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const input = inviteCreateSchema.parse(await readJson(request));
  const { invite, url, emailed } = await createInvite(admin, input);
  return NextResponse.json({ invite: { id: invite.id, email: invite.email, role: invite.role }, url, emailed }, { status: 201 });
});
