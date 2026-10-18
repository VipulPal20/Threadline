"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/domain/constants";
import { api } from "@/lib/client-api";
import { NumberField } from "../ui/fields";

export function AlumniSettingsForm({ initial }: { initial: { maxActiveConnections: number; acceptingRequests: boolean } }) {
  const [capacity, setCapacity] = useState(String(initial.maxActiveConnections));
  const [accepting, setAccepting] = useState(initial.acceptingRequests);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/alumni/settings", { method: "PUT", json: { maxActiveConnections: Number(capacity), acceptingRequests: accepting } });
      setMessage("Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-xl space-y-5">
      <p className="rounded-xl bg-lime-soft p-3 text-sm">
        Only you can see these settings. Students and your institute admin never see your capacity; it only decides when the system shows you to students.
      </p>
      <NumberField
        id="capacity"
        label="Students you can actively help at once"
        min={LIMITS.minAlumniCapacity}
        max={LIMITS.maxAlumniCapacity}
        help="When you reach this number you are hidden from new students until a conversation is resolved or closed."
        value={capacity}
        onChange={setCapacity}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accepting} onChange={(event) => setAccepting(event.target.checked)} />
        I am open to new requests (turn off to pause)
      </label>
      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={busy} className="btn-dark">{busy ? "Saving…" : "Save settings"}</button>
        {message && <span role="status" className="text-sm text-lime-dark">{message}</span>}
        {error && <span role="alert" className="text-sm text-sun-dark">{error}</span>}
      </div>
    </div>
  );
}
