"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { csvRow } from "@/lib/metrics/stats";
import { LocalTime } from "../ui/LocalTime";
import { useRefresh } from "@/lib/use-refresh";

export interface InviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface BulkResult {
  created: Array<{ line: number; email: string; role: string; url: string }>;
  skipped: Array<{ line: number; email: string; reason: string }>;
  tooMany: boolean;
  limit: number;
}

const input = "w-full rounded-xl border border-line bg-[#fbfcf9] px-3.5 py-3 text-sm outline-none focus:border-lime-dark focus:ring-4 focus:ring-lime-soft";
const label = "block text-sm font-semibold normal-case tracking-normal text-ink";

function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function InviteManager({ invites }: { invites: InviteRow[] }) {
  const refresh = useRefresh();
  const [link, setLink] = useState<{ email: string; url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<BulkResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setLink(null);
    setCopied(false);
    try {
      const body = await api<{ url: string; emailed: boolean }>("/api/admin/invites", { method: "POST", json: { email: data.get("email"), role: data.get("role"), name: String(data.get("name") ?? "") || undefined } });
      setLink({ email: String(data.get("email")), url: body.url, emailed: body.emailed });
      form.reset();
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function resend(invite: InviteRow) {
    setError(null);
    setCopied(false);
    try {
      const result = await api<{ url: string; email: string; emailed: boolean }>(`/api/admin/invites/${invite.id}/resend`, { method: "POST" });
      setLink({ email: result.email, url: result.url, emailed: result.emailed });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resend the invite.");
    }
  }

  async function uploadCsv(file: File | undefined) {
    if (!file) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulk(null);
    try {
      setBulk(await api<BulkResult>("/api/admin/invites/bulk", { method: "POST", json: { csv: await file.text() } }));
      refresh();
    } catch (cause) {
      setBulkError(cause instanceof Error ? cause.message : "Could not read that file.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-6">
          <div className="card h-fit">
            <h2 className="text-lg font-semibold">Invite one person</h2>
            <p className="mt-1 text-sm text-muted">Invited people skip the email-domain check and approval.</p>
            <form onSubmit={create} className="mt-5 space-y-4">
              <div className="space-y-1.5"><label htmlFor="inv-email" className={label}>Email</label><input id="inv-email" name="email" type="email" required className={input} /></div>
              <div className="space-y-1.5"><label htmlFor="inv-name" className={label}>Name (optional)</label><input id="inv-name" name="name" className={input} /></div>
              <div className="space-y-1.5">
                <label htmlFor="inv-role" className={label}>Role</label>
                <select id="inv-role" name="role" className={input} defaultValue="alumni"><option value="alumni">Alumni</option><option value="student">Student</option></select>
              </div>
              {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
              <button type="submit" disabled={busy} className="btn-dark w-full">{busy ? "Creating…" : "Send invite"}</button>
            </form>
            {link && (
              <div className="mt-5 rounded-xl bg-lime-soft p-4">
                <p className="text-sm font-semibold">{link.emailed ? `We emailed the invite to ${link.email}.` : `Email isn't set up or didn't send, so share this link with ${link.email} yourself.`} The link is shown only once.</p>
                <p className="mt-2 break-all font-mono text-xs">{link.url}</p>
                <button type="button" onClick={() => copy(link.url)} className="btn-ghost mt-3 px-4 py-2">{copied ? "Copied" : "Copy link"}</button>
              </div>
            )}
          </div>

          <div className="card h-fit">
            <h2 className="text-lg font-semibold">Invite many from a CSV</h2>
            <p className="mt-1 text-sm text-muted">Columns: <code className="font-mono text-xs">name,email,role</code> where role is <code className="font-mono text-xs">student</code> or <code className="font-mono text-xs">alumni</code>. A header row is optional. Up to 200 rows.</p>
            <input type="file" accept=".csv,text/csv" disabled={bulkBusy} onChange={(event) => { void uploadCsv(event.target.files?.[0]); event.target.value = ""; }} aria-label="Upload CSV of invitees" className="mt-4 block text-sm" />
            {bulkBusy && <p className="mt-3 text-sm text-muted">Creating invites…</p>}
            {bulkError && <p role="alert" className="mt-3 rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{bulkError}</p>}
            {bulk && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="rounded-xl bg-lime-soft p-3"><strong>{bulk.created.length}</strong> invite{bulk.created.length === 1 ? "" : "s"} created{bulk.skipped.length ? `, ${bulk.skipped.length} skipped` : ""}.{bulk.tooMany ? ` Only the first ${bulk.limit} rows were read.` : ""}</p>
                {bulk.created.length > 0 && (
                  <button type="button" onClick={() => downloadCsv("invite-links.csv", [csvRow(["email", "role", "link"]), ...bulk.created.map((row) => csvRow([row.email, row.role.toLowerCase(), row.url]))].join("\n") + "\n")} className="btn-primary w-full">Download the links (CSV)</button>
                )}
                {bulk.created.length > 0 && <p className="text-xs text-muted">Links are shown only once, so download them now and send each person their own.</p>}
                {bulk.skipped.length > 0 && (
                  <ul className="space-y-1 rounded-xl bg-sun-soft p-3 text-xs text-sun-dark">
                    {bulk.skipped.map((row) => <li key={`${row.line}-${row.email}`}>Line {row.line}{row.email ? ` (${row.email})` : ""}: {row.reason}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {invites.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No invites yet.</td></tr>}
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{invite.email}</td>
                  <td className="px-4 py-3 capitalize">{invite.role.toLowerCase()}</td>
                  <td className="px-4 py-3"><span className="badge">{invite.status.toLowerCase()}</span></td>
                  <td className="px-4 py-3 text-muted"><LocalTime iso={invite.createdAt} mode="date" /></td>
                  <td className="px-4 py-3 text-right">{invite.status !== "ACCEPTED" && <button type="button" onClick={() => resend(invite)} className="text-sm underline">New link</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
