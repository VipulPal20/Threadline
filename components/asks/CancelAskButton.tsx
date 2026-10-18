"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useRefresh } from "@/lib/use-refresh";

export function CancelAskButton({ askId }: { askId: string }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancel this ask? It still counts toward this month's allowance.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/asks/${askId}/cancel`, { method: "POST" });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" onClick={cancel} disabled={busy} className="btn-ghost px-4 py-2 text-sun-dark">{busy ? "Cancelling…" : "Cancel this ask"}</button>
      {error && <span role="alert" className="ml-3 text-sm text-sun-dark">{error}</span>}
    </span>
  );
}
