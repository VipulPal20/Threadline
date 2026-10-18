import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { getSettings, updateSettings } from "@/lib/services/admin";
import { settingsSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json(await getSettings(admin));
});

export const PUT = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  return NextResponse.json(await updateSettings(admin, settingsSchema.parse(await readJson(request))));
});
