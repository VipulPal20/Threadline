import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelAskButton } from "@/components/asks/CancelAskButton";
import { MatchCardView } from "@/components/asks/MatchCardView";
import { RequestButton } from "@/components/asks/RequestButton";
import { RequestsPanel } from "@/components/asks/RequestsPanel";
import { requirePageUser } from "@/lib/auth/current";
import { LIMITS, type AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import { ApiError } from "@/lib/errors";
import { getOwnAsk } from "@/lib/services/asks";
import { getMatchesForAsk } from "@/lib/services/matching";
import { getRequestsForAsk } from "@/lib/services/requests";

export default async function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requirePageUser("STUDENT");
  let ask: Awaited<ReturnType<typeof getOwnAsk>>;
  try {
    ask = await getOwnAsk(student, (await params).id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const requests = await getRequestsForAsk(student, ask.id);
  const result = await getMatchesForAsk(student, ask.id);
  const canRequest = ask.status === "OPEN";
  const pending = requests.filter((request) => request.state === "PENDING").length;
  const limitReason = pending >= LIMITS.maxPendingPerAsk ? `You have ${pending} requests waiting. Wait for a reply or withdraw one.` : undefined;

  return (
    <>
      <Link href="/student/asks" className="text-sm text-muted underline">← My asks</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-3">
            <span className="badge">{STATUS_LABELS[ask.status] ?? ask.status}</span>
            <h1 className="text-2xl font-bold">{ask.title}</h1>
            <p className="text-xs font-bold uppercase tracking-wide text-lime-dark">{CATEGORY_LABELS[ask.category as AskCategory]}</p>
            <p className="whitespace-pre-line text-sm text-muted">{ask.description}</p>
            <dl className="space-y-1 text-sm">
              {ask.targetRole && <div><dt className="inline text-muted">Target role: </dt><dd className="inline">{ask.targetRole}</dd></div>}
              {ask.targetCompany && <div><dt className="inline text-muted">Company: </dt><dd className="inline">{ask.targetCompany}</dd></div>}
              {ask.location && <div><dt className="inline text-muted">Location: </dt><dd className="inline">{ask.location}</dd></div>}
              {ask.deadline && <div><dt className="inline text-muted">Needed by: </dt><dd className="inline">{ask.deadline}</dd></div>}
            </dl>
            <ul className="flex flex-wrap gap-1.5">
              {ask.skills.map((skill) => (
                <li key={skill.name} className={`rounded-full px-2.5 py-1 text-xs ${skill.importance === "MUST" ? "bg-lime-soft" : "bg-[#edf0e9]"}`}>{skill.name}{skill.importance === "NICE" ? " (nice)" : ""}</li>
              ))}
            </ul>
            {(ask.status === "OPEN" || ask.status === "IN_PROGRESS") && <CancelAskButton askId={ask.id} />}
          </div>
        </aside>

        <div>
          {ask.status === "RESOLVED" && (
            <div className="card mb-8 space-y-1 bg-lime-soft">
              <h2 className="text-xl font-bold">Resolved ✓</h2>
              <p className="text-sm">You rated the help {ask.rating}/5{ask.resolutionNote ? `: “${ask.resolutionNote}”` : "."}</p>
            </div>
          )}
          <RequestsPanel requests={requests} />
          {ask.status === "IN_PROGRESS" ? (
            <p className="card text-sm text-muted">An alumnus has accepted, so we&apos;ve stopped suggesting others. Open the conversation above. When you have what you need, mark the ask resolved there.</p>
          ) : (
            <section>
              <span className="eyebrow">{result.live ? "your top matches" : "matches shown before this ask closed"}</span>
              <h2 className="mb-5 mt-2 text-3xl font-bold">{result.matches.length ? `Your top ${result.matches.length}` : "No matches yet"}</h2>
              {result.companyFilterRelaxed && (
                <p className="mb-4 rounded-xl bg-sun-soft px-4 py-3 text-sm text-sun-dark">Nobody available works at {ask.targetCompany} right now, so we&apos;re showing the closest matches.</p>
              )}
              {result.matches.length === 0 ? (
                <div className="card space-y-2 text-sm text-muted">
                  <p>{canRequest ? "No other alumni who can help with this are available right now." : "No matches were recorded for this ask."}</p>
                  {canRequest && <p>Try adding a few more skills or loosening the target company. Freed-up helpers appear when you reload.</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {result.matches.map((card) => (
                    <MatchCardView
                      key={card.alumnus.id}
                      card={card}
                      action={canRequest ? <RequestButton askId={ask.id} alumniId={card.alumnus.id} alumniName={card.alumnus.name} disabledReason={limitReason} /> : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
