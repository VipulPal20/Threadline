import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { handle, readJson } from "@/lib/http";
import { draftRequest } from "@/lib/services/requests";
import { draftRequestSchema } from "@/lib/validation/request";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  const student = await requireApiUser("STUDENT");
  hit(`draft:${student.id}`, 40, HOUR_MS);
  const { askId, alumniId } = draftRequestSchema.parse(await readJson(request));
  return NextResponse.json(await draftRequest(student, askId, alumniId));
});
