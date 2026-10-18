import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { exportMyData } from "@/lib/services/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads everything held about the signed-in person as a JSON file. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const data = await exportMyData(user);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="threadline-my-data.json"',
      "cache-control": "no-store",
    },
  });
});
