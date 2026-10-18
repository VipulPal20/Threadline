import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import type { AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import { listRequestsForAlumnus } from "@/lib/services/requests";

const STATE_LABEL: Record<string, string> = { PENDING: "Needs your answer", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", CLOSED: "Closed" };

export default async function AlumniRequestsPage() {
  const alumnus = await requirePageUser("ALUMNI");
  const requests = await listRequestsForAlumnus(alumnus);
  const pending = requests.filter((request) => request.state === "PENDING");
  const rest = requests.filter((request) => request.state !== "PENDING");

  const row = (request: (typeof requests)[number]) => (
    <Link key={request.id} href={`/alumni/requests/${request.id}`} className="link-card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">{request.ask.title}</h3>
        <p className="text-sm text-muted">
          {request.student.name}
          {request.student.department ? ` · ${request.student.department}` : ""} · {CATEGORY_LABELS[request.ask.category as AskCategory]}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {request.matchPercent != null && <span className="font-mono text-xs text-muted">{request.matchPercent}% match</span>}
        <span className="badge">{STATE_LABEL[request.state] ?? request.state}</span>
      </div>
    </Link>
  );

  return (
    <>
      <span className="eyebrow">alumni</span>
      <h1 className="mt-2 text-4xl font-extrabold leading-none md:text-5xl">Requests</h1>
      <h2 className="mb-3 mt-8 text-2xl font-bold">Waiting for you</h2>
      <div className="space-y-3">
        {pending.length === 0 ? <div className="card text-sm text-muted">Nothing is waiting. New requests appear here and in your notifications.</div> : pending.map(row)}
      </div>
      {rest.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-2xl font-bold">Earlier</h2>
          <div className="space-y-3">{rest.map(row)}</div>
        </>
      )}
    </>
  );
}
