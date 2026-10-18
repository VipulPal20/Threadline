import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { handle, readJson } from "@/lib/http";
import { listRequestsForAlumnus, sendRequest } from "@/lib/services/requests";
import { sendRequestSchema } from "@/lib/validation/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alumni inbox: requests this alumnus received. */
export const GET = handle(async () => {
  const alumnus = await requireApiUser("ALUMNI");
  return NextResponse.json({ requests: await listRequestsForAlumnus(alumnus) });
});

/** Student sends a request, with their (edited) draft, to one of their current top three. */
export const POST = handle(async (request) => {
  const student = await requireApiUser("STUDENT");
  hit(`send-request:${student.id}`, 30, HOUR_MS);
  const input = sendRequestSchema.parse(await readJson(request));
  const id = await sendRequest(student, input);
  return NextResponse.json({ id }, { status: 201 });
});
