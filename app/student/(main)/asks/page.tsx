import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import type { AskCategory } from "@/lib/domain/constants";
import { askQuota, listAsks } from "@/lib/services/asks";

export default async function AsksPage() {
  const student = await requirePageUser("STUDENT");
  const [asks, quota] = await Promise.all([listAsks(student), askQuota(student)]);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">student</span>
          <h1 className="mt-2 text-4xl font-extrabold leading-none md:text-5xl">My asks</h1>
        </div>
        <Link href="/student/asks/new" className="btn-primary">New ask ↗</Link>
      </div>
      <p className="mt-3 text-sm text-muted">{quota.remaining} of {quota.limit} asks left this month.</p>
      <div className="mt-8 space-y-3">
        {asks.length === 0 && <div className="card text-center text-muted">You haven&apos;t posted an ask yet.</div>}
        {asks.map((ask) => (
          <Link key={ask.id} href={`/student/asks/${ask.id}`} className="link-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{ask.title}</h2>
              <p className="text-sm text-muted">
                {CATEGORY_LABELS[ask.category as AskCategory]}
                {ask.deadline ? ` · needed by ${ask.deadline}` : ""}
              </p>
            </div>
            <span className="badge">{STATUS_LABELS[ask.status] ?? ask.status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
