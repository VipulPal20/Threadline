"use client";

import { useState, type ReactNode } from "react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  render: () => ReactNode;
}

interface Props {
  steps: WizardStep[];
  /** "wizard": one step at a time, autosaving on Next. "page": every section stacked with one Save button. */
  mode: "wizard" | "page";
  /** Saves the whole form. `submit` is true only on the final step. Throws with a readable message on failure. */
  onSave: (submit: boolean) => Promise<void>;
  onDone: () => void;
  submitLabel: string;
  percent: number;
}

export function Wizard({ steps, mode, onSave, onDone, submitLabel, percent }: Props) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function run(submit: boolean, after: () => void) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(submit);
      after();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const meter = (
    <div className="mb-8" aria-label={`Profile ${percent}% complete`}>
      <div className="mb-1.5 flex justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>{mode === "wizard" ? `Step ${index + 1} of ${steps.length}` : "Your profile"}</span>
        <span>{percent}% complete</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-lime transition-all" style={{ width: `${percent}%` }} /></div>
    </div>
  );

  const errorBox = error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>;

  if (mode === "page") {
    return (
      <div>
        {meter}
        <div className="space-y-6">
          {steps.map((step) => (
            <section key={step.id} className="card space-y-5">
              <div>
                <h2 className="text-xl font-bold">{step.title}</h2>
                {step.description && <p className="mt-1 text-sm text-muted">{step.description}</p>}
              </div>
              {step.render()}
            </section>
          ))}
        </div>
        <div className="sticky bottom-0 mt-6 flex items-center gap-4 border-t border-line bg-paper/95 py-4">
          <button type="button" disabled={busy} onClick={() => run(false, () => setSaved(true))} className="btn-dark">{busy ? "Saving…" : "Save changes"}</button>
          {saved && <span role="status" className="text-sm text-lime-dark">Saved.</span>}
          {errorBox}
        </div>
      </div>
    );
  }

  const step = steps[index]!;
  const last = index === steps.length - 1;
  return (
    <div>
      {meter}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {steps.map((item, position) => (
          <li key={item.id} className={`rounded-full px-3 py-1 ${position === index ? "bg-ink text-white" : position < index ? "bg-lime-soft text-lime-dark" : "bg-[#edf0e9] text-muted"}`}>
            {position + 1}. {item.title}
          </li>
        ))}
      </ol>
      <section className="card space-y-5">
        <div>
          <h2 className="text-2xl font-bold">{step.title}</h2>
          {step.description && <p className="mt-1 text-sm text-muted">{step.description}</p>}
        </div>
        {step.render()}
      </section>
      <div className="mt-6 space-y-4">
        {errorBox}
        <div className="flex justify-between gap-3">
          <button type="button" disabled={busy || index === 0} onClick={() => setIndex(index - 1)} className="btn-ghost">Back</button>
          {last ? (
            <button type="button" disabled={busy} onClick={() => run(true, onDone)} className="btn-primary">{busy ? "Submitting…" : submitLabel}</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => run(false, () => setIndex(index + 1))} className="btn-dark">{busy ? "Saving…" : "Save and continue"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
