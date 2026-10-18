import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getRequestForAlumnus } from "@/lib/services/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const alumnus = await requireApiUser("ALUMNI");
  return NextResponse.json({ request: await getRequestForAlumnus(alumnus, (await params).id) });
});
