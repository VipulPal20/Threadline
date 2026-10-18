import Link from "next/link";
import { LocalTime } from "@/components/ui/LocalTime";
import { requirePageUser } from "@/lib/auth/current";
import { alumniDashboardCounts, listRequestsForAlumnus } from "@/lib/services/requests";

export default async function AlumniDashboardPage() {
  const user = await requirePageUser("ALUMNI");
  const [counts, requests] = await Promise.all([alumniDashboardCounts(user), listRequestsForAlumnus(user)]);
  const pending = requests.filter((request) => request.state === "PENDING");

  return (
    <>
      <span className="eyebrow">alumni</span>
      <h1 className="mt-2 text-5xl font-extrabold leading-none md:text-6xl">Welcome back, {user.name.split(" ")[0]} <span className="inline-block origin-[70%_70%] animate-wiggle">👋</span></h1>
      <p className="mt-3 text-lg text-muted">Thanks for being someone students can lean on.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="stat bg-sun-soft"><span className="text-sm font-semibold">Waiting for you</span><div className="mt-3 font-display text-6xl font-extrabold">{counts.pending}</div></div>
        <div className="stat bg-lime"><span className="text-sm font-semibold">Students you&apos;re helping</span><div className="mt-3 font-display text-6xl font-extrabold">{counts.active}</div></div>
        <div className="stat flex flex-col justify-between gap-4 bg-ink text-white"><span className="text-sm font-semibold">All requests</span><Link href="/alumni/requests" className="btn-primary">Open requests</Link></div>
      </div>
      <h2 className="mb-4 mt-10 text-2xl font-bold">Needs your answer</h2>
      <div className="space-y-3">
        {pending.length === 0 && <div className="card text-sm text-muted">No requests are waiting. You&apos;ll get a notification when a student asks for your help.</div>}
        {pending.map((request) => (
          <Link key={request.id} href={`/alumni/requests/${request.id}`} className="link-card flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold">{request.ask.title}</h3><p className="text-sm text-muted">{request.student.name}</p></div>
            <span className="badge">answer by <LocalTime iso={request.expiresAt} mode="date" /></span>
          </Link>
        ))}
      </div>
    </>
  );
}
