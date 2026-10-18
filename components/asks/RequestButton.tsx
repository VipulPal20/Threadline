"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { Modal } from "../ui/Modal";
import { inputClass } from "../ui/fields";
import { useRefresh } from "@/lib/use-refresh";

/** Opens an editable draft for one match; sending creates the request. */
export function RequestButton({ askId, alumniId, alumniName, disabledReason }: { askId: string; alumniId: string; alumniName: string; disabledReason?: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setMessage("");
    try {
      const draft = await api<{ message: string; usedFallback: boolean }>("/api/intros/draft", { method: "POST", json: { askId, alumniId } });
      setMessage(draft.message);
      setUsedFallback(draft.usedFallback);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare a draft.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api("/api/intros", { method: "POST", json: { askId, alumniId, message } });
      setOpen(false);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={Boolean(disabledReason)} className="btn-dark" title={disabledReason}>
        Ask {alumniName.split(" ")[0]} for help ↗
      </button>
      {disabledReason && <p className="mt-2 text-xs text-muted">{disabledReason}</p>}
      <Modal open={open} onClose={() => setOpen(false)} title={`Message ${alumniName}`}>
        {loading ? (
          <p className="text-sm text-muted">Writing a first draft for you…</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {usedFallback ? "Here's a starting point built from your ask and profile." : "Here's a draft based on your ask and profile."} Edit it so it sounds like you. Don&apos;t add emails or phone numbers; if {alumniName.split(" ")[0]} accepts, you&apos;ll talk right here in the chat.
            </p>
            <label htmlFor="request-message" className="sr-only">Your message</label>
            <textarea id="request-message" rows={10} value={message} maxLength={1500} onChange={(event) => setMessage(event.target.value)} className={inputClass} />
            <p className="text-right font-mono text-[11px] text-muted">{message.length} / 1500</p>
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
          <button type="button" onClick={send} disabled={loading || sending || message.trim().length < 30} className="btn-primary">{sending ? "Sending…" : "Send request"}</button>
        </div>
      </Modal>
    </div>
  );
}
