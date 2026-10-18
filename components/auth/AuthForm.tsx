"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface AuthField {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  help?: string;
  defaultValue?: string;
  autoComplete?: string;
}

interface Props {
  endpoint: string;
  submitLabel: string;
  fields: AuthField[];
  /** Extra values posted with the form (for example the role). */
  extra?: Record<string, string>;
  /** Adds the required "I agree to the Terms and Privacy Policy" box (account creation forms). */
  requireTerms?: boolean;
}

export function AuthForm({ endpoint, submitLabel, fields, extra, requireTerms }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string | boolean> = { ...extra };
    for (const field of fields) body[field.name] = String(form.get(field.name) ?? "");
    if (requireTerms) body.acceptTerms = form.get("acceptTerms") === "on";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { redirect?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} method="post" action="#" className="space-y-4" noValidate>
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <label htmlFor={field.name} className="block text-sm font-semibold normal-case tracking-normal text-ink">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type={field.type ?? "text"}
            placeholder={field.placeholder}
            defaultValue={field.defaultValue}
            autoComplete={field.autoComplete}
            required
            className="w-full rounded-xl border border-line bg-[#fbfcf9] px-3.5 py-3 outline-none focus:border-lime-dark focus:ring-4 focus:ring-lime-soft"
          />
          {field.help && <p className="text-xs text-muted">{field.help}</p>}
        </div>
      ))}
      {requireTerms && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#172019]" />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-semibold underline">Terms</Link> and the{" "}
            <Link href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</Link>.
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !ready} className="btn-dark w-full">
        {busy ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
