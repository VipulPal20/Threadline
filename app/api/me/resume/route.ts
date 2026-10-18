import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { badRequest } from "@/lib/errors";
import { assertBodyUnder, handle } from "@/lib/http";
import { uploadResume } from "@/lib/services/resumes";

export const runtime = "nodejs";

export const POST = handle(async (request) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  hit(`resume:${user.id}`, 15, HOUR_MS);
  assertBodyUnder(request, 6 * 1024 * 1024); // a 5 MB file plus form overhead
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Upload a PDF résumé in the file field.");
  const result = await uploadResume(user, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
  return NextResponse.json(result, { status: 201 });
});
