import { NextResponse } from "next/server";
import { z } from "zod";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { clientIp, handle, readJson } from "@/lib/http";
import { completeReset } from "@/lib/services/password-reset";
import { passwordSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10, "Invalid reset link."), password: passwordSchema });

export const POST = handle(async (request) => {
  hit(`reset:${clientIp(request)}`, 10, HOUR_MS);
  const { token, password } = schema.parse(await readJson(request));
  const { role } = await completeReset(token, password);
  return NextResponse.json({ redirect: `/login/${role.toLowerCase()}` });
});
