import Link from "next/link";
import { LocalTime } from "@/components/ui/LocalTime";
import { requirePageUser } from "@/lib/auth/current";
import { ASK_CATEGORIES, ASK_STATUSES, type AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import { listAdminAsks } from "@/lib/services/admin";
import { adminAskFilterSchema } from "@/lib/validation/admin";

const field = "mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export default async function AdminAsksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requirePageUser("ADMIN");
  const parsed = adminAskFilterSchema.safeParse(Object.fromEntries(Object.entries(await searchParams).filter(([, value]) => value)));
  const filter = parsed.success ? parsed.data : adminAskFilterSchema.parse({});
  const result = await listAdminAsks(admin, filter);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const keep = Object.entries({ status: filter.status, category: filter.category, domain: filter.domain, q: filter.q, from: filter.from, to: filter.to }).filter(([, value]) => value);
  const pageHref = (page: number) => `/admin/asks?${new URLSearchParams([...(keep as Array<[string, string]>), ["page", String(page)]]).toString()}`;

  return (
    <>
      <span className="eyebrow">asks</span>
      <h1 className="mt-2 text-4xl font-extrabold leading-none md:text-5xl">Every ask, start to finish</h1>

      <form method="get" className="card mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs text-muted lg:col-span-2">Search<input name="q" defaultValue={filter.q} placeholder="Title or student" className={field} /></label>
        <label className="text-xs text-muted">Status
          <select name="status" defaultValue={filter.status ?? ""} className={field}><option value="">Any</option>{ASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Type
          <select name="category" defaultValue={filter.category ?? ""} className={field}><option value="">Any</option>{ASK_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select>
        </label>
        <label className="text-xs text-muted">From<input type="date" name="from" defaultValue={filter.from} className={field} /></label>
        <label className="text-xs text-muted">To<input type="date" name="to" defaultValue={filter.to} className={field} /></label>
        <label className="text-xs text-muted lg:col-span-2">Domain<input name="domain" defaultValue={filter.domain} placeholder="e.g. data analytics" className={field} /></label>
        <div className="flex items-end gap-3 lg:col-span-4">
          <button type="submit" className="btn-dark">Filter</button>
          <Link href="/admin/asks" className="btn-ghost">Clear</Link>
          <span className="ml-auto text-sm text-muted">{result.total} {result.total === 1 ? "ask" : "asks"}</span>
        </div>
      </form>

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Ask</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Requests</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Posted</th></tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No asks match these filters.</td></tr>}
            {result.rows.map((ask) => (
              <tr key={ask.id} className="border-b border-line last:border-0 hover:bg-lime-soft/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/asks/${ask.id}`} className="font-semibold underline-offset-2 hover:underline">{ask.title}</Link>
                  <div className="text-muted">{CATEGORY_LABELS[ask.category as AskCategory]}{ask.domain ? ` · ${ask.domain}` : ""}</div>
                </td>
                <td className="px-4 py-3">{ask.student.name}</td>
                <td className="px-4 py-3"><span className="badge">{STATUS_LABELS[ask.status] ?? ask.status}</span></td>
                <td className="px-4 py-3">{ask.requests}{ask.accepted ? " · accepted" : ""}</td>
                <td className="px-4 py-3">{ask.rating ? `${ask.rating}/5` : "—"}</td>
                <td className="px-4 py-3 text-muted"><LocalTime iso={ask.createdAt} mode="date" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {filter.page > 1 ? <Link href={pageHref(filter.page - 1)} className="btn-ghost">← Newer</Link> : <span />}
          <span className="text-muted">Page {filter.page} of {pages}</span>
          {filter.page < pages ? <Link href={pageHref(filter.page + 1)} className="btn-ghost">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
