import Link from "next/link";
import type { AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import type { ConversationView } from "@/lib/services/conversations";
import { ChatPanel } from "./ChatPanel";
import { ResolvePanel } from "./ResolvePanel";

/** Shared conversation page for both roles. Contact details show only while the conversation is active. */
export function ConversationScreen({ view, backHref }: { view: ConversationView; backHref: string }) {
  const { other, ask } = view;
  const active = view.status === "ACTIVE";
  return (
    <>
      <Link href={backHref} className="text-sm text-muted underline">← Conversations</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <ChatPanel
          conversationId={view.id}
          otherName={other.name}
          initial={{ status: view.status, canSend: view.canSend, messages: view.messages }}
        />

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="card space-y-3">
            <span className="eyebrow">{other.role === "ALUMNI" ? "your alumnus" : "the student"}</span>
            <h1 className="text-2xl font-bold">{other.name}</h1>
            <p className="text-sm text-muted">
              {[other.currentTitle, other.currentCompany].filter(Boolean).join(" at ") || other.headline}
              {other.graduationYear ? ` · Class of ${other.graduationYear}` : ""}
            </p>
            {other.department && <p className="text-sm text-muted">{other.department}{other.city ? ` · ${other.city}` : ""}</p>}
            {other.linkedinUrl && active && <a href={other.linkedinUrl} target="_blank" rel="noreferrer" className="block text-xs underline">LinkedIn profile ↗</a>}
            <p className="text-xs text-muted">Email and phone numbers are never shown. Talk to each other here.</p>
            {other.resumeId && active && <a href={`/api/resumes/${other.resumeId}`} target="_blank" rel="noreferrer" className="btn-ghost w-full">View résumé (PDF)</a>}
          </section>

          <section className="card space-y-3">
            <span className="eyebrow">the ask</span>
            <h2 className="text-lg font-bold">{ask.title}</h2>
            <p className="text-xs font-bold uppercase tracking-wide text-lime-dark">{CATEGORY_LABELS[ask.category as AskCategory]}</p>
            <p className="line-clamp-6 whitespace-pre-line text-sm text-muted">{ask.description}</p>
            {ask.deadline && <p className="text-sm"><span className="text-muted">Needed by: </span>{ask.deadline}</p>}
            <ResolvePanel conversationId={view.id} askId={ask.id} iAmStudent={view.iAmStudent} active={active} askStatus={ask.status} rating={ask.rating} />
          </section>
        </aside>
      </div>
    </>
  );
}
