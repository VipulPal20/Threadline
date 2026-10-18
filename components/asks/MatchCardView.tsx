import type { MatchCard } from "@/lib/dto/match";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import type { AskCategory } from "@/lib/domain/constants";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function MatchCardView({ card, action }: { card: MatchCard; action?: React.ReactNode }) {
  const { alumnus } = card;
  return (
    <article className="card space-y-5">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-soft font-bold text-sky-dark" aria-hidden>{initials(alumnus.name)}</div>
        <div className="min-w-0 flex-1">
          <span className="badge">#{card.rank} match</span>
          <h3 className="mt-2 text-xl font-bold">{alumnus.name}</h3>
          <p className="text-sm text-muted">
            {[alumnus.currentTitle, alumnus.currentCompany].filter(Boolean).join(" at ") || alumnus.headline}
            {alumnus.graduationYear ? ` · Class of ${alumnus.graduationYear}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold leading-none">{card.matchPercent}%</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">match</div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        {card.reasons.map((reason) => (
          <li key={reason} className="rounded-lg bg-[#f3f6ef] px-2.5 py-1.5 text-xs text-[#4f5c50]">{reason}</li>
        ))}
      </ul>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {card.breakdown.map((part) => (
          <div key={part.key}>
            <div className="flex justify-between text-xs"><dt className="text-muted">{part.label}</dt><dd className="font-mono">{part.percent}%</dd></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-lime" style={{ width: `${part.percent}%` }} /></div>
          </div>
        ))}
      </dl>

      {(alumnus.skills.length > 0 || alumnus.helpTypes.length > 0) && (
        <div className="space-y-1 border-t border-line pt-4 text-xs text-muted">
          {alumnus.skills.length > 0 && <p>Skills: {alumnus.skills.join(", ")}</p>}
          {alumnus.helpTypes.length > 0 && <p>Helps with: {alumnus.helpTypes.map((type) => CATEGORY_LABELS[type as AskCategory] ?? type).join(", ")}</p>}
        </div>
      )}
      {action}
    </article>
  );
}
