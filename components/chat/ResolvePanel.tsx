"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { Modal } from "../ui/Modal";
import { inputClass } from "../ui/fields";
import { useRefresh } from "@/lib/use-refresh";

interface Props {
  conversationId: string;
  askId: string;
  iAmStudent: boolean;
  active: boolean;
  askStatus: string;
  rating: number | null;
}

export function ResolvePanel({ conversationId, askId, iAmStudent, active, askStatus, rating }: Props) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/asks/${askId}/resolve`, { method: "POST", json: { rating: stars, note } });
      setOpen(false);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark resolved.");
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    const message = iAmStudent
      ? "End this conversation without resolving? Your ask will reopen so you can ask someone else."
      : "End this conversation? The student will be told and can ask someone else.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/conversations/${conversationId}/close`, { method: "POST" });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the conversation.");
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return askStatus === "RESOLVED" ? (
      <p className="rounded-xl bg-lime-soft p-3 text-sm">
        Resolved ✓{iAmStudent && rating ? ` · you rated it ${rating}/5` : ""}. The alumnus has been told, and their place is free again.
      </p>
    ) : (
      <p className="rounded-xl bg-[#edf0e9] p-3 text-sm text-muted">This conversation has ended.</p>
    );
  }

  return (
    <div className="space-y-3">
      {iAmStudent && <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">Mark as resolved ✓</button>}
      <button type="button" onClick={end} disabled={busy} className="btn-ghost w-full">{iAmStudent ? "End without resolving" : "End conversation"}</button>
      {error && !open && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-2.5 text-sm text-sun-dark">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Did you get the help you needed?">
        <p className="text-sm text-muted">Marking this resolved closes the conversation and tells the alumnus thank you. Your rating helps your institute see what works.</p>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold normal-case tracking-normal text-ink">How helpful was it?</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={stars === value} aria-label={`${value} out of 5`} onClick={() => setStars(value)} className={`h-12 w-12 rounded-xl border text-lg ${stars >= value ? "border-lime-dark bg-lime text-ink" : "border-line bg-white text-muted"}`}>
                ★
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="resolve-note" className="mb-1.5 block text-sm font-semibold normal-case tracking-normal text-ink">Anything to add? (optional)</label>
          <textarea id="resolve-note" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Not yet</button>
          <button type="button" onClick={resolve} disabled={busy || stars === 0} className="btn-primary">{busy ? "Saving…" : "Mark resolved"}</button>
        </div>
      </Modal>
    </div>
  );
}
