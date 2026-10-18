import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { forbidden } from "@/lib/errors";
import { handle, readJson } from "@/lib/http";
import { getAlumniProfile, getStudentProfile, saveAlumniProfile, saveStudentProfile } from "@/lib/services/profiles";
import { alumniProfileSchema, studentProfileSchema } from "@/lib/validation/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's own profile. Alumni see their private capacity here, and nowhere else. */
export const GET = handle(async () => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  const view = user.role === "STUDENT" ? await getStudentProfile(user.id) : await getAlumniProfile(user.id);
  return NextResponse.json(view);
});

export const PUT = handle(async (request) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  const body = await readJson(request);
  if (user.role === "STUDENT") return NextResponse.json(await saveStudentProfile(user, studentProfileSchema.parse(body)));
  if (user.role === "ALUMNI") return NextResponse.json(await saveAlumniProfile(user, alumniProfileSchema.parse(body)));
  throw forbidden();
});
