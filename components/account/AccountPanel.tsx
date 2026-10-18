"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { Modal } from "../ui/Modal";

/** Email switch, data download and account deletion. Shared by students and alumni. */
export function AccountPanel({ initialEmailNotifications, termsAcceptedAt }: { initialEmailNotifications: boolean; termsAcceptedAt: string | null }) {
  const [emails, setEmails] = useState(initialEmailNotifications);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggleEmails(next: boolean) {
    setEmails(next);
    setError(null);
    try {
      await api("/api/account/preferences", { method: "PATCH", json: { emailNotifications: next } });
    } catch (cause) {
      setEmails(!next);
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/delete", { method: "POST", json: { password } });
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the account.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <h2 className="text-2xl font-bold">Emails</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={emails} onChange={(event) => void toggleEmails(event.target.checked)} className="mt-1 h-5 w-5 accent-[#172019]" />
          <span>
            <strong>Email me about activity.</strong>
            <br />
            <span className="text-sm text-muted">New requests, answers and messages. You always see them in the app too.</span>
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-2xl font-bold">Your data</h2>
        <p className="text-sm text-muted">
          Your email and phone number are never shown to other users.{" "}
          {termsAcceptedAt ? <>You agreed to the terms on {new Date(termsAcceptedAt).toISOString().slice(0, 10)}. </> : null}
          Read the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
        <a href="/api/account/export" className="btn-ghost">Download my data (JSON)</a>
      </section>

      <section className="card space-y-3 border-sun">
        <h2 className="text-2xl font-bold">Delete my account</h2>
        <p className="text-sm text-muted">
          This ends your open conversations and requests, removes your profile and résumé, and replaces your name and email with placeholders. It can&apos;t be undone.
        </p>
        <button type="button" onClick={() => setConfirming(true)} className="btn bg-sun-soft text-sun-dark hover:bg-sun hover:text-white">Delete my account</button>
      </section>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Delete your account?">
        <form onSubmit={deleteAccount} className="space-y-4">
          <p className="text-sm text-muted">Enter your password to confirm. You will be signed out straight away.</p>
          <div className="space-y-1.5">
            <label htmlFor="delete-password" className="block text-sm font-semibold">Password</label>
            <input id="delete-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-sm outline-none focus:border-ink" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="btn bg-sun text-white">{busy ? "Deleting…" : "Yes, delete everything"}</button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
