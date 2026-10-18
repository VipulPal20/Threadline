import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getAdminAsk } from "@/lib/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json({ ask: await getAdminAsk(admin, (await params).id) });
});
