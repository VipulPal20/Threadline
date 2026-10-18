import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { setEmailNotifications } from "@/lib/services/account";

export const runtime = "nodejs";

const schema = z.object({ emailNotifications: z.boolean() });

export const PATCH = handle(async (request) => {
  const user = await requireApiUser();
  const input = schema.parse(await readJson(request));
  await setEmailNotifications(user, input.emailNotifications);
  return NextResponse.json({ ok: true });
});
