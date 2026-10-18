"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "@/lib/client-api";
import { Field, inputClass } from "../ui/fields";

export interface SkillValue {
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "EXPERT";
}

const LEVELS: Array<{ value: SkillValue["level"]; label: string }> = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "EXPERT", label: "Expert" },
];

export function SkillsEditor({ value, onChange, help }: { value: SkillValue[]; onChange: (value: SkillValue[]) => void; help?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ skills: string[] }>(`/api/skills?q=${encodeURIComponent(q)}`)
        .then((data) => setSuggestions(data.skills.filter((name) => !value.some((skill) => skill.name === name))))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, value]);

  function add(raw: string) {
    const name = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!name || value.some((skill) => skill.name === name)) return;
    onChange([...value, { name, level: "INTERMEDIATE" }]);
    setQuery("");
    setSuggestions([]);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(query);
    }
  }

  return (
    <Field label="Skills" htmlFor="skill-input" help={help ?? "Type a skill and press Enter. Pick a level for each; matching uses this."}>
      <div className="relative">
        <input id="skill-input" value={query} placeholder="e.g. sql, react, product management" autoComplete="off" onChange={(event) => setQuery(event.target.value)} onKeyDown={onKey} className={inputClass} />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-white shadow-lift">
            {suggestions.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => add(name)} className="w-full px-3.5 py-2 text-left text-sm hover:bg-lime-soft">{name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((skill) => (
            <li key={skill.name} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <span className="flex-1 text-sm font-medium">{skill.name}</span>
              <select aria-label={`Level for ${skill.name}`} value={skill.level} onChange={(event) => onChange(value.map((item) => (item.name === skill.name ? { ...item, level: event.target.value as SkillValue["level"] } : item)))} className="rounded-lg border border-line bg-[#fbfcf9] px-2 py-1 text-xs">
                {LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
              <button type="button" onClick={() => onChange(value.filter((item) => item.name !== skill.name))} aria-label={`Remove ${skill.name}`} className="px-2 text-muted hover:text-sun-dark">✕</button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
