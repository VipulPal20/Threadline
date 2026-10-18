import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/current";
import { handle } from "@/lib/http";

export const runtime = "nodejs";

export const POST = handle(async () => {
  await clearSession();
  return NextResponse.json({ redirect: "/" });
});
