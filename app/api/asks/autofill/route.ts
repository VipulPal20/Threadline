import { NextResponse } from "next/server";
import { autofillAsk } from "@/lib/ai/autofill";
import { requireApiUser } from "@/lib/auth/current";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { handle, readJson } from "@/lib/http";
import { autofillSchema } from "@/lib/validation/ask";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  const student = await requireApiUser("STUDENT");
  hit(`autofill:${student.id}`, 40, HOUR_MS);
  const { description } = autofillSchema.parse(await readJson(request));
  return NextResponse.json(await autofillAsk(student, description));
});
