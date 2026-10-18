"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useRefresh } from "@/lib/use-refresh";

export function WithdrawButton({ requestId }: { requestId: string }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!window.confirm("Withdraw this request?")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/intros/${requestId}/withdraw`, { method: "POST" });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" onClick={withdraw} disabled={busy} className="text-sm text-sun-dark underline">{busy ? "Withdrawing…" : "Withdraw"}</button>
      {error && <span role="alert" className="ml-2 text-xs text-sun-dark">{error}</span>}
    </span>
  );
}
