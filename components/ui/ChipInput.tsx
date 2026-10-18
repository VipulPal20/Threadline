"use client";

import { useState, type KeyboardEvent } from "react";
import { Field, inputClass } from "./fields";

/** Free-text list input: type, press Enter or comma to add, click a chip to remove it. */
export function ChipInput({ id, label, help, value, onChange, placeholder, max = 10 }: { id: string; label: string; help?: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string; max?: number }) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const item = raw.trim();
    if (!item || value.some((existing) => existing.toLowerCase() === item.toLowerCase()) || value.length >= max) return;
    onChange([...value, item]);
    setDraft("");
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <Field label={label} htmlFor={id} help={help ?? `Press Enter to add (up to ${max}).`}>
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <button key={item} type="button" onClick={() => onChange(value.filter((existing) => existing !== item))} className="rounded-full border border-line bg-lime-soft px-3 py-1 text-xs hover:bg-sun-soft" aria-label={`Remove ${item}`}>
            {item} ✕
          </button>
        ))}
      </div>
      <input id={id} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} className={inputClass} />
    </Field>
  );
}
