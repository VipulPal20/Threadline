import Link from "next/link";
import { DemandSupplyChart, FunnelChart, TrendChart } from "@/components/admin/MetricsCharts";
import { requirePageUser } from "@/lib/auth/current";
import { parseRange } from "@/lib/metrics/stats";
import { getInstitute } from "@/lib/services/institutes";
import { getMetrics } from "@/lib/services/metrics";

const dash = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card stat">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-2 font-display text-5xl font-extrabold">{value}</div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const admin = await requirePageUser("ADMIN");
  const range = parseRange((await searchParams).from, (await searchParams).to);
  const [institute, metrics] = await Promise.all([getInstitute(admin.instituteId), getMetrics(admin, range)]);
  const { kpis, people, fairness, engagement } = metrics;
  const query = `from=${metrics.range.from}&to=${metrics.range.to}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">institute admin</span>
          <h1 className="mt-2 text-5xl font-extrabold leading-none md:text-6xl">{institute.name}</h1>
          <p className="mt-1 text-sm text-muted">Is help landing? Every number below is counted from real activity in your institute.</p>
        </div>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-xs text-muted">From<input type="date" name="from" defaultValue={metrics.range.from} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
          <label className="text-xs text-muted">To<input type="date" name="to" defaultValue={metrics.range.to} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
          <button type="submit" className="btn-dark">Apply</button>
          <a href={`/api/admin/metrics/export?${query}`} className="btn-ghost">Export CSV</a>
        </form>
      </div>

      {people.pendingApproval > 0 && (
        <p className="mt-6 rounded-xl bg-sun-soft px-4 py-3 text-sm text-sun-dark">
          {people.pendingApproval} {people.pendingApproval === 1 ? "account is" : "accounts are"} waiting for your approval.{" "}
          <Link href="/admin/users?status=PENDING_APPROVAL" className="font-semibold underline">Review now</Link>
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Students" value={String(people.students)} note="active accounts" />
        <Kpi label="Alumni" value={String(people.alumni)} note={people.pendingApproval ? `${people.pendingApproval} awaiting approval` : "active accounts"} />
        <Kpi label="Profiles complete" value={dash(people.onboardingCompletion, "%")} note="of active members" />
        <Kpi label="Asks in period" value={String(kpis.asks)} note={`${kpis.requests} requests sent`} />
        <Kpi label="Resolution rate" value={dash(kpis.resolutionRate, "%")} note={`${kpis.resolved} resolved, cancelled asks not counted`} />
        <Kpi label="Time to first reply" value={dash(kpis.medianHoursToFirstResponse, " h")} note="median, from request to answer" />
        <Kpi label="Time to resolution" value={dash(kpis.medianHoursToResolution, " h")} note="median, from ask to resolved" />
        <Kpi label="Requests accepted" value={dash(kpis.acceptanceRate, "%")} note="of answered or expired requests" />
        <Kpi label="Average rating" value={kpis.averageRating === null ? "—" : `${kpis.averageRating} / 5`} note="given by students at resolution" />
        <Kpi label="Active alumni" value={String(engagement.activeAlumni)} note="accepted a student in the last 30 days" />
        <Kpi label="Load on top 10%" value={dash(fairness.topDecileShare, "%")} note={fairness.gini === null ? "of requests; needs more data" : `of requests · Gini ${fairness.gini}`} />
        <div className="card flex flex-col justify-between gap-3">
          <span className="eyebrow">institute code</span>
          <p className="font-mono text-xl font-semibold tracking-widest">{institute.joinCode}</p>
          <Link href="/admin/settings" className="text-sm underline">Manage in settings</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FunnelChart funnel={metrics.funnel} />
        <TrendChart trend={metrics.trend} />
      </div>

      <div className="mt-6">
        <DemandSupplyChart rows={metrics.demandSupply} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h3 className="text-lg font-bold">Unmet demand</h3>
          <p className="text-sm text-muted">Asks that never found help: they expired, or nobody who could help was available.</p>
          {metrics.unmet.length === 0 ? (
            <p className="text-sm text-muted">None in this period.</p>
          ) : (
            <ul className="divide-y divide-line">
              {metrics.unmet.map((item) => <li key={item.label} className="flex justify-between py-2 text-sm"><span>{item.label}</span><span className="font-mono">{item.count}</span></li>)}
            </ul>
          )}
        </section>
        <section className="card space-y-3">
          <h3 className="text-lg font-bold">Most helpful alumni</h3>
          <p className="text-sm text-muted">By asks resolved in this period.</p>
          {engagement.topHelpers.length === 0 ? (
            <p className="text-sm text-muted">No resolved asks in this period yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {engagement.topHelpers.map((helper, index) => (
                <li key={helper.id} className="flex justify-between py-2 text-sm">
                  <span>{index + 1}. {helper.name}</span>
                  <span className="font-mono">{helper.resolved} resolved{helper.averageRating !== null ? ` · ${helper.averageRating}★` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="card mt-6 space-y-2 text-sm text-muted">
        <h3 className="text-base font-bold text-ink">How these are counted</h3>
        <p>Asks, resolution rate, time to resolution, rating and the funnel use asks <em>posted</em> in the period. The weekly chart counts each event in the week it happened. Time to first reply and the acceptance rate use requests sent in the period. Message text is never read or shown to admins.</p>
        <p>Load on the top 10% is the share of requests in the period that went to the busiest tenth of active alumni; the Gini figure runs from 0 (everyone gets the same) towards 1 (one person gets almost all).</p>
      </div>
    </>
  );
}
