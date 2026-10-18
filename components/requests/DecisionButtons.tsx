"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { inputClass } from "../ui/fields";
import { useRefresh } from "@/lib/use-refresh";

export function DecisionButtons({ requestId }: { requestId: string }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "accept" | "decline") {
    setBusy(kind);
    setError(null);
    try {
      await api(`/api/intros/${requestId}/${kind}`, { method: "POST", json: kind === "decline" ? { reason } : {} });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => decide("accept")} disabled={busy !== null} className="btn-primary">{busy === "accept" ? "Accepting…" : "Accept and start chatting"}</button>
        <button type="button" onClick={() => setDeclining((value) => !value)} disabled={busy !== null} className="btn-ghost">Decline</button>
      </div>
      {declining && (
        <div className="space-y-3 rounded-xl border border-line bg-white p-4">
          <label htmlFor="decline-reason" className="block text-sm font-semibold">Reason (optional)</label>
          <textarea id="decline-reason" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
          <p className="text-xs text-muted">The student is told only that you can&apos;t help right now. Your reason is kept for your institute&apos;s records.</p>
          <button type="button" onClick={() => decide("decline")} disabled={busy !== null} className="btn-dark">{busy === "decline" ? "Declining…" : "Confirm decline"}</button>
        </div>
      )}
      <p className="text-xs text-muted">Accepting shares your email and phone with this student and opens a conversation. You can only help as many students at once as your own limit allows.</p>
      {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
    </div>
  );
}
