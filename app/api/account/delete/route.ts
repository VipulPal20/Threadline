import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSession, requireApiUser } from "@/lib/auth/current";
import { hit } from "@/lib/auth/rate-limit";
import { handle, readJson } from "@/lib/http";
import { deleteMyAccount } from "@/lib/services/account";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1, "Enter your password to confirm.") });

export const POST = handle(async (request) => {
  const user = await requireApiUser();
  hit(`account-delete:${user.id}`, 5, 60 * 60 * 1000);
  const input = schema.parse(await readJson(request));
  await deleteMyAccount(user, input.password);
  await clearSession();
  return NextResponse.json({ redirect: "/" });
});
