"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { LocalTime } from "../ui/LocalTime";
import { Modal } from "../ui/Modal";
import { useRefresh } from "@/lib/use-refresh";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  completeness: number;
}

const ACTIONS: Record<string, Array<{ action: "approve" | "suspend" | "reactivate"; label: string }>> = {
  PENDING_APPROVAL: [
    { action: "approve", label: "Approve" },
    { action: "suspend", label: "Reject" },
  ],
  ACTIVE: [{ action: "suspend", label: "Suspend" }],
  SUSPENDED: [{ action: "reactivate", label: "Reactivate" }],
};

export function UsersTable({ users }: { users: UserRow[] }) {
  const refresh = useRefresh();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState<{ name: string; email: string; url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function makeResetLink(user: UserRow) {
    setBusyId(user.id);
    setError(null);
    setCopied(false);
    try {
      const result = await api<{ url: string; name: string; email: string; emailed: boolean }>(`/api/admin/users/${user.id}/reset-link`, { method: "POST" });
      setReset(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a reset link.");
    } finally {
      setBusyId(null);
    }
  }

  async function run(id: string, action: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? "Action failed.");
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (users.length === 0) return <div className="card text-center text-muted">No members match this filter.</div>;

  return (
    <div className="card overflow-x-auto p-0">
      {error && <p role="alert" className="m-4 rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Profile</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <Link href={`/admin/users/${user.id}`} className="font-semibold underline-offset-2 hover:underline">{user.name}</Link>
                <div className="text-muted">{user.email}</div>
              </td>
              <td className="px-4 py-3 capitalize">{user.role.toLowerCase()}</td>
              <td className="px-4 py-3"><span className="badge">{user.status.replace("_", " ").toLowerCase()}</span></td>
              <td className="px-4 py-3 text-muted">{user.completeness}%</td>
              <td className="px-4 py-3 text-muted"><LocalTime iso={user.createdAt} mode="date" /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {user.status === "ACTIVE" && (
                    <button disabled={busyId === user.id} onClick={() => makeResetLink(user)} className="btn-ghost px-3 py-1.5">Reset password</button>
                  )}
                  {(ACTIONS[user.status] ?? []).map((item) => (
                    <button key={item.action} disabled={busyId === user.id} onClick={() => run(user.id, item.action)} className="btn-ghost px-3 py-1.5">
                      {item.label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={reset !== null} onClose={() => setReset(null)} title="Password reset link">
        {reset && (
          <>
            <p className="text-sm text-muted">{reset.emailed ? `We emailed this one-time link to ${reset.name}. You can also pass it on yourself.` : `Email isn't set up or didn't send, so send this one-time link to ${reset.name} (${reset.email}) yourself.`} It works for 24 hours, can be used once, and is shown only now. They will be signed out everywhere when they use it.</p>
            <p className="break-all rounded-xl bg-lime-soft p-3 font-mono text-xs">{reset.url}</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(reset.url).catch(() => undefined); setCopied(true); }} className="btn-primary">{copied ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={() => setReset(null)} className="btn-ghost">Close</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
