import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/ui/LocalTime";
import { requirePageUser } from "@/lib/auth/current";
import type { AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import { ApiError } from "@/lib/errors";
import { getAdminAsk } from "@/lib/services/admin";

const DOT: Record<string, string> = { ask: "bg-ink", match: "bg-sky-dark", request: "bg-lime-dark", response: "bg-sun", conversation: "bg-lime", resolution: "bg-ink" };

export default async function AdminAskPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageUser("ADMIN");
  let ask: Awaited<ReturnType<typeof getAdminAsk>>;
  try {
    ask = await getAdminAsk(admin, (await params).id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <Link href="/admin/asks" className="text-sm text-muted underline">← All asks</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <aside className="card h-fit space-y-3">
          <span className="badge">{STATUS_LABELS[ask.status] ?? ask.status}</span>
          <h1 className="text-2xl font-bold">{ask.title}</h1>
          <p className="text-xs font-bold uppercase tracking-wide text-lime-dark">{CATEGORY_LABELS[ask.categoryLabel as AskCategory]}</p>
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Student: </dt><dd className="inline"><Link href={`/admin/users/${ask.student.id}`} className="underline">{ask.student.name}</Link></dd></div>
            {ask.domain && <div><dt className="inline text-muted">Domain: </dt><dd className="inline">{ask.domain}</dd></div>}
            {ask.targetRole && <div><dt className="inline text-muted">Target role: </dt><dd className="inline">{ask.targetRole}</dd></div>}
            {ask.targetCompany && <div><dt className="inline text-muted">Company: </dt><dd className="inline">{ask.targetCompany}</dd></div>}
            {ask.location && <div><dt className="inline text-muted">Location: </dt><dd className="inline">{ask.location}</dd></div>}
            {ask.deadline && <div><dt className="inline text-muted">Needed by: </dt><dd className="inline">{ask.deadline}</dd></div>}
            {ask.rating && <div><dt className="inline text-muted">Rating: </dt><dd className="inline">{ask.rating}/5</dd></div>}
          </dl>
          <ul className="flex flex-wrap gap-1.5">
            {ask.skills.map((skill) => <li key={skill.name} className={`rounded-full px-2.5 py-1 text-xs ${skill.importance === "MUST" ? "bg-lime-soft" : "bg-[#edf0e9]"}`}>{skill.name}{skill.importance === "NICE" ? " (nice)" : ""}</li>)}
          </ul>
        </aside>

        <section className="card">
          <h2 className="text-xl font-bold">Timeline</h2>
          <p className="mb-5 mt-1 text-sm text-muted">What happened, in order. Message text is private and not shown here.</p>
          <ol className="space-y-5 border-l border-line pl-6">
            {ask.timeline.map((event, index) => (
              <li key={`${event.at}-${index}`} className="relative">
                <span className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT[event.kind] ?? "bg-ink"}`} aria-hidden />
                <p className="text-sm font-medium">{event.text}</p>
                <p className="font-mono text-[11px] text-muted"><LocalTime iso={event.at} /></p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
