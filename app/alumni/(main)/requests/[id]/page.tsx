import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionButtons } from "@/components/requests/DecisionButtons";
import { LocalTime } from "@/components/ui/LocalTime";
import { requirePageUser } from "@/lib/auth/current";
import type { AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import { ApiError } from "@/lib/errors";
import { getRequestForAlumnus } from "@/lib/services/requests";

const STATE_LABEL: Record<string, string> = { PENDING: "Needs your answer", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired", CLOSED: "Closed", WITHDRAWN: "Withdrawn" };

export default async function AlumniRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const alumnus = await requirePageUser("ALUMNI");
  let request: Awaited<ReturnType<typeof getRequestForAlumnus>>;
  try {
    request = await getRequestForAlumnus(alumnus, (await params).id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { student, ask } = request;

  return (
    <>
      <Link href="/alumni/requests" className="text-sm text-muted underline">← Requests</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <span className="badge">{STATE_LABEL[request.state] ?? request.state}</span>
            <h1 className="text-3xl font-bold">{ask.title}</h1>
            <p className="text-xs font-bold uppercase tracking-wide text-lime-dark">{CATEGORY_LABELS[ask.category as AskCategory]}</p>
            <p className="whitespace-pre-line text-sm">{ask.description}</p>
            <dl className="space-y-1 text-sm">
              {ask.targetRole && <div><dt className="inline text-muted">Target role: </dt><dd className="inline">{ask.targetRole}</dd></div>}
              {ask.targetCompany && <div><dt className="inline text-muted">Company: </dt><dd className="inline">{ask.targetCompany}</dd></div>}
              {ask.location && <div><dt className="inline text-muted">Location: </dt><dd className="inline">{ask.location}</dd></div>}
              {ask.deadline && <div><dt className="inline text-muted">Needed by: </dt><dd className="inline">{ask.deadline}</dd></div>}
            </dl>
            <ul className="flex flex-wrap gap-1.5">
              {ask.skills.map((skill) => <li key={skill.name} className="rounded-full bg-lime-soft px-2.5 py-1 text-xs">{skill.name}</li>)}
            </ul>
          </section>

          <section className="card space-y-3">
            <h2 className="text-xl font-bold">Their message</h2>
            <p className="whitespace-pre-line rounded-xl bg-[#f3f6ef] p-4 text-sm">{request.message}</p>
            {request.match && (
              <div className="text-sm">
                <p className="font-semibold">Why you were suggested ({request.match.percent}% match)</p>
                <ul className="mt-1 list-disc pl-5 text-muted">{request.match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
          </section>

          {request.state === "PENDING" && (
            <section className="card space-y-3">
              <h2 className="text-xl font-bold">Your answer</h2>
              <p className="text-sm text-muted">Please answer by <LocalTime iso={request.expiresAt} />.</p>
              <DecisionButtons requestId={request.id} />
            </section>
          )}
          {request.state === "ACCEPTED" && (
            <section className="card space-y-2 bg-lime-soft">
              <h2 className="text-xl font-bold">You accepted</h2>
              <p className="text-sm">You can talk to {student.name} in the conversation.</p>
              {request.conversationId && <Link href={`/alumni/conversations/${request.conversationId}`} className="btn-primary mt-2">Open the conversation ↗</Link>}
            </section>
          )}
        </div>

        <aside className="card h-fit space-y-4">
          <div>
            <span className="eyebrow">the student</span>
            <h2 className="mt-2 text-2xl font-bold">{student.name}</h2>
            <p className="text-sm text-muted">{[student.degree, student.department].filter(Boolean).join(" · ")}{student.graduationYear ? ` · Class of ${student.graduationYear}` : ""}</p>
            {student.headline && <p className="mt-2 text-sm">{student.headline}</p>}
          </div>
          {student.bio && <p className="text-sm text-muted">{student.bio}</p>}
          {student.targetRoles.length > 0 && <p className="text-sm"><span className="text-muted">Aiming for: </span>{student.targetRoles.join(", ")}</p>}
          {student.skills.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {student.skills.map((skill) => <li key={skill.name} className="rounded-full bg-[#edf0e9] px-2.5 py-1 text-xs">{skill.name}</li>)}
            </ul>
          )}
          {student.experiences.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">Experience</p>
              <ul className="mt-1 space-y-1 text-muted">{student.experiences.map((item) => <li key={item.id}>{item.title}{item.organisation ? `, ${item.organisation}` : ""}</li>)}</ul>
            </div>
          )}
          {student.educations.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">Education</p>
              <ul className="mt-1 space-y-1 text-muted">{student.educations.map((item) => <li key={item.id}>{[item.degree, item.institution].filter(Boolean).join(", ")}</li>)}</ul>
            </div>
          )}
          {request.resumeId && <a href={`/api/resumes/${request.resumeId}`} target="_blank" rel="noreferrer" className="btn-ghost w-full">View résumé (PDF)</a>}
          {[student.linkedinUrl, student.githubUrl, student.portfolioUrl].some(Boolean) && request.state === "ACCEPTED" && (
            <ul className="space-y-1 text-sm">
              {[student.linkedinUrl, student.githubUrl, student.portfolioUrl].filter((url): url is string => Boolean(url)).map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="underline">{url}</a></li>)}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
