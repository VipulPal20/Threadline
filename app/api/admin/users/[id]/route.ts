import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getAdminUser } from "@/lib/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json(await getAdminUser(admin, (await params).id));
});
