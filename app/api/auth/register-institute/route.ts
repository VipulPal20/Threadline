import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth/login";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { clientIp, handle, readJson } from "@/lib/http";
import { registerInstitute } from "@/lib/services/institutes";
import { registerInstituteSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  hit(`register-institute:${clientIp(request)}`, 5, HOUR_MS);
  const input = registerInstituteSchema.parse(await readJson(request));
  const { institute, admin } = await registerInstitute(input);
  await startSession(request, admin.id);
  return NextResponse.json({ redirect: "/admin/dashboard", joinCode: institute.joinCode }, { status: 201 });
});
