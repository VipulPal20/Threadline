import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import type { AskCategory } from "@/lib/domain/constants";
import { askQuota, listAsks } from "@/lib/services/asks";

export default async function StudentDashboardPage() {
  const user = await requirePageUser("STUDENT");
  const [asks, quota] = await Promise.all([listAsks(user), askQuota(user)]);
  const open = asks.filter((ask) => ask.status === "OPEN" || ask.status === "IN_PROGRESS");

  return (
    <>
      <span className="eyebrow">student</span>
      <h1 className="mt-2 text-5xl font-extrabold leading-none md:text-6xl">Hey {user.name.split(" ")[0]} <span className="inline-block origin-[70%_70%] animate-wiggle">👋</span></h1>
      <p className="mt-3 text-lg text-muted">What do you need help with today?</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="stat bg-lime"><span className="text-sm font-semibold">Open asks</span><div className="mt-3 font-display text-6xl font-extrabold">{open.length}</div></div>
        <div className="stat bg-sky-soft"><span className="text-sm font-semibold">Asks left this month</span><div className="mt-3 font-display text-6xl font-extrabold">{quota.remaining}<span className="text-xl font-bold text-ink/60"> / {quota.limit}</span></div></div>
        <div className="stat flex flex-col justify-between gap-4 bg-ink text-white"><span className="text-sm font-semibold">Need help?</span><Link href="/student/asks/new" className="btn-primary">Ask for help ↗</Link></div>
      </div>
      <h2 className="mb-4 mt-10 text-2xl font-bold">Recent asks</h2>
      <div className="space-y-3">
        {asks.length === 0 && <div className="card text-sm text-muted">Post your first ask and we&apos;ll show you the three alumni best placed to help.</div>}
        {asks.slice(0, 5).map((ask) => (
          <Link key={ask.id} href={`/student/asks/${ask.id}`} className="link-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{ask.title}</h3>
              <p className="text-sm text-muted">{CATEGORY_LABELS[ask.category as AskCategory]}</p>
            </div>
            <span className="badge">{STATUS_LABELS[ask.status] ?? ask.status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
