import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { bulkCreateInvites } from "@/lib/services/invites";
import { bulkInviteSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const { csv } = bulkInviteSchema.parse(await readJson(request));
  return NextResponse.json(await bulkCreateInvites(admin, csv), { status: 201 });
});
