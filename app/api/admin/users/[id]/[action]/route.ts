import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { applyUserAction } from "@/lib/services/users";

export const runtime = "nodejs";

const actionSchema = z.enum(["approve", "suspend", "reactivate"]);

export const POST = handle(async (_request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const admin = await requireApiUser("ADMIN");
  const action = actionSchema.parse((await params).action);
  return NextResponse.json({ user: await applyUserAction(admin, (await params).id, action) });
});
