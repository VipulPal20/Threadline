import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { HOUR_MS, hit } from "@/lib/auth/rate-limit";
import { handle, readJson } from "@/lib/http";
import { assistInConversation } from "@/lib/services/chat-assist";
import { assistSchema } from "@/lib/validation/conversation";

export const runtime = "nodejs";

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  hit(`chat-ai:${user.id}`, 60, HOUR_MS);
  const { task, text } = assistSchema.parse(await readJson(request));
  return NextResponse.json(await assistInConversation(user, (await params).id, task, text));
});
