import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { parseRange } from "@/lib/metrics/stats";
import { exportAsksCsv } from "@/lib/services/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of the asks created in the range. */
export const GET = handle(async (request) => {
  const admin = await requireApiUser("ADMIN");
  const params = request.nextUrl.searchParams;
  const range = parseRange(params.get("from"), params.get("to"));
  const csv = await exportAsksCsv(admin, range);
  const name = `asks-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
});
