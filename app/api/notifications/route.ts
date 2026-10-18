import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { listNotifications, markNotificationsRead } from "@/lib/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireApiUser();
  return NextResponse.json(await listNotifications(user));
});

const readSchema = z.object({ ids: z.array(z.string()).max(100).optional() });

/** Marks the caller's notifications as read: the given ids, or all when none are given. */
export const POST = handle(async (request) => {
  const user = await requireApiUser();
  const { ids } = readSchema.parse(await readJson(request).catch(() => ({})));
  await markNotificationsRead(user, ids);
  return NextResponse.json({ ok: true });
});
