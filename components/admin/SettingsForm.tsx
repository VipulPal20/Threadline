"use client";

import { useState } from "react";
import { api, toNumber } from "@/lib/client-api";
import { NumberField, TextField } from "../ui/fields";
import { useRefresh } from "@/lib/use-refresh";

interface Settings {
  name: string;
  joinCode: string;
  allowedEmailDomains: string[];
  requireApproval: boolean;
  requestExpiryHours: number;
  monthlyAskLimit: number;
  aiEnabled: boolean;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const refresh = useRefresh();
  const [name, setName] = useState(initial.name);
  const [domains, setDomains] = useState(initial.allowedEmailDomains.join(", "));
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);
  const [expiry, setExpiry] = useState(String(initial.requestExpiryHours));
  const [limit, setLimit] = useState(String(initial.monthlyAskLimit));
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [code, setCode] = useState(initial.joinCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/admin/settings", { method: "PUT", json: { name, allowedEmailDomains: domains, requireApproval, requestExpiryHours: toNumber(expiry), monthlyAskLimit: toNumber(limit), aiEnabled } });
      setMessage("Saved.");
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!window.confirm("Make a new institute code? The old code stops working straight away. Current members are not affected.")) return;
    setError(null);
    try {
      const result = await api<{ joinCode: string }>("/api/admin/settings/rotate-code", { method: "POST" });
      setCode(result.joinCode);
      setMessage("New code created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the code.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
      <section className="card space-y-5">
        <h2 className="text-xl font-bold">Institute</h2>
        <TextField id="name" label="Institute name" value={name} onChange={setName} maxLength={120} />
        <TextField id="domains" label="Student email domains" value={domains} onChange={setDomains} help="Students can sign up with an email from these domains (subdomains count too). Separate several with commas." />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} />
          <span><strong>Approve alumni before they can sign in.</strong><br /><span className="text-muted">Recommended: alumni often use personal emails, so you confirm who they are. Invited people skip approval.</span></span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="expiry" label="Hours an alumnus has to answer" min={1} max={720} value={expiry} onChange={setExpiry} help="Unanswered requests expire after this long (or at the ask's deadline, if sooner)." />
          <NumberField id="limit" label="Asks per student per month" min={1} max={20} value={limit} onChange={setLimit} help="Cancelled asks still count." />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} />
          <span><strong>Allow AI help.</strong><br /><span className="text-muted">Drafts, résumé reading and chat help. Contact details are removed before anything is sent. Turn off to use plain templates only.</span></span>
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={save} disabled={busy} className="btn-dark">{busy ? "Saving…" : "Save settings"}</button>
          {message && <span role="status" className="text-sm text-lime-dark">{message}</span>}
          {error && <span role="alert" className="text-sm text-sun-dark">{error}</span>}
        </div>
      </section>

      <section className="card h-fit space-y-4">
        <h2 className="text-xl font-bold">Institute code</h2>
        <p className="text-sm text-muted">Students and alumni enter this when they sign up.</p>
        <p className="rounded-xl bg-lime-soft p-4 text-center font-mono text-2xl font-semibold tracking-widest">{code}</p>
        <button type="button" onClick={rotate} className="btn-ghost w-full">Make a new code</button>
      </section>
    </div>
  );
}
