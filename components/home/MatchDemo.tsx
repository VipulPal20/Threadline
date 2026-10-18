"use client";

import { useMemo, useState } from "react";

const SKILLS = ["SQL", "Python", "Figma", "Marketing", "Product", "Excel"];

interface Sample {
  name: string;
  role: string;
  skills: string[];
  full?: boolean;
  tone: string;
}

const SAMPLE: Sample[] = [
  { name: "Asha R.", role: "Data analyst · Fintech", skills: ["SQL", "Python", "Excel"], tone: "bg-lime" },
  { name: "Dev M.", role: "Product manager · SaaS", skills: ["Product", "SQL", "Marketing"], tone: "bg-sun-soft" },
  { name: "Mira K.", role: "Designer · Studio", skills: ["Figma", "Product"], tone: "bg-sky-soft" },
  { name: "Tomas L.", role: "Growth lead · Retail", skills: ["Marketing", "Excel", "Python"], tone: "bg-lime-soft" },
  { name: "Priya S.", role: "Engineer · Cloud", skills: ["Python", "SQL"], full: true, tone: "bg-[#e8e4f4]" },
];

const ROW = 76;

/** The "live thing": pick what you need and watch sample alumni re-rank. Sample data only; the real scoring has more signals. */
export function MatchDemo() {
  const [picked, setPicked] = useState<string[]>(["SQL"]);

  const ranked = useMemo(() => {
    const visible = SAMPLE.filter((person) => !person.full);
    return visible
      .map((person) => ({ person, score: picked.length ? Math.round((person.skills.filter((skill) => picked.includes(skill)).length / picked.length) * 100) : 0 }))
      .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
  }, [picked]);

  function toggle(skill: string) {
    setPicked((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  }

  const order = new Map(ranked.map((entry, index) => [entry.person.name, index]));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
      <div>
        <p className="text-lg">What do you need help with?</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Skills you need help with">
          {SKILLS.map((skill) => {
            const on = picked.includes(skill);
            return (
              <button key={skill} type="button" aria-pressed={on} onClick={() => toggle(skill)} className={`rounded-full px-4 py-2 text-sm font-semibold transition duration-200 active:scale-90 ${on ? "scale-105 bg-ink text-white" : "bg-white text-ink hover:-translate-y-0.5 hover:bg-lime"}`}>
                {on ? "✓ " : ""}{skill}
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-sm text-muted">
          Sample alumni, for illustration. Priya is at her own limit, so she never appears, exactly like the real thing.
        </p>
      </div>

      <ol aria-label="Top matches" className="relative" style={{ height: ranked.length * ROW }}>
        {ranked.map(({ person, score }) => {
          const index = order.get(person.name) ?? 0;
          const top = index < 3 && score > 0;
          return (
            <li key={person.name} className="absolute inset-x-0 transition-transform duration-500 ease-[cubic-bezier(.34,1.3,.64,1)]" style={{ transform: `translateY(${index * ROW}px)`, height: ROW - 10 }}>
              <div className={`flex h-full items-center gap-4 rounded-2xl px-4 transition-colors duration-300 ${top ? person.tone : "bg-white/60 text-muted"}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{person.name}</p>
                  <p className="truncate text-xs opacity-75">{person.role}</p>
                </div>
                <div className="hidden gap-1 sm:flex">
                  {person.skills.map((skill) => (
                    <span key={skill} className={`rounded-full px-2 py-0.5 text-[11px] ${picked.includes(skill) ? "bg-ink text-white" : "bg-black/5"}`}>{skill}</span>
                  ))}
                </div>
                <span className="w-12 text-right font-display text-xl font-bold">{score}%</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
