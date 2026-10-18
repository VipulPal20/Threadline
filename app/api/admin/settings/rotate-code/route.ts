import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { rotateJoinCode } from "@/lib/services/admin";

export const runtime = "nodejs";

export const POST = handle(async () => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json({ joinCode: await rotateJoinCode(admin) });
});
