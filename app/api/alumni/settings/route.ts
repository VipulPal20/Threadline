import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { getAlumniSettings, updateAlumniSettings } from "@/lib/services/profiles";
import { alumniSettingsSchema } from "@/lib/validation/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only: this is the one place an alumnus can read and change their private capacity. */
export const GET = handle(async () => {
  const user = await requireApiUser("ALUMNI");
  return NextResponse.json(await getAlumniSettings(user));
});

export const PUT = handle(async (request) => {
  const user = await requireApiUser("ALUMNI");
  const input = alumniSettingsSchema.parse(await readJson(request));
  return NextResponse.json(await updateAlumniSettings(user, input));
});
