"use client";

import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-sm outline-none transition duration-200 placeholder:text-muted/60 focus:-translate-y-0.5 focus:border-ink focus:shadow-[0_4px_0_0_#b8d830] disabled:opacity-60";
export const labelClass = "block text-sm font-semibold text-ink";

export function Field({ label, htmlFor, help, children, className = "" }: { label: string; htmlFor?: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      {children}
      {help && <p className="text-xs text-muted">{help}</p>}
    </div>
  );
}

interface BaseProps {
  id: string;
  label: string;
  help?: string;
  className?: string;
}

export function TextField({ id, label, help, className, value, onChange, type = "text", placeholder, maxLength }: BaseProps & { value: string; onChange: (value: string) => void; type?: string; placeholder?: string; maxLength?: number }) {
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <input id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </Field>
  );
}

export function NumberField({ id, label, help, className, value, onChange, min, max, step }: BaseProps & { value: string; onChange: (value: string) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <input id={id} type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </Field>
  );
}

export function TextAreaField({ id, label, help, className, value, onChange, rows = 4, maxLength }: BaseProps & { value: string; onChange: (value: string) => void; rows?: number; maxLength?: number }) {
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </Field>
  );
}

export function SelectField({ id, label, help, className, value, onChange, options }: BaseProps & { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Select…</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}
