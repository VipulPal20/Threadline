import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle, readJson } from "@/lib/http";
import { fetchMessages, sendMessage } from "@/lib/services/conversations";
import { messageSchema } from "@/lib/validation/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The thread. Polled every few seconds by the chat page; also marks the other person's messages as read. */
export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  return NextResponse.json(await fetchMessages(user, (await params).id));
});

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  const input = messageSchema.parse(await readJson(request));
  return NextResponse.json({ message: await sendMessage(user, (await params).id, input) }, { status: 201 });
});
