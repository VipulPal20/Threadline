"use client";

import { useState } from "react";
import { ASK_CATEGORIES } from "@/lib/domain/constants";
import { CATEGORY_LABELS, URGENCY_LABELS, WORK_MODE_LABELS } from "@/lib/domain/labels";
import { api } from "@/lib/client-api";
import type { AskSuggestion } from "@/lib/validation/ask";
import { Field, SelectField, TextAreaField, TextField, inputClass } from "../ui/fields";

interface SkillRow {
  name: string;
  importance: "MUST" | "NICE";
}

export function AskForm({ quota }: { quota: { used: number; limit: number; remaining: number } }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [filling, setFilling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addSkill(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name || skills.some((skill) => skill.name === name) || skills.length >= 12) return;
    setSkills([...skills, { name, importance: "MUST" }]);
    setSkillDraft("");
  }

  async function autofill() {
    setFilling(true);
    setError(null);
    setNote(null);
    try {
      const { suggestion, usedFallback } = await api<{ suggestion: AskSuggestion; usedFallback: boolean }>("/api/asks/autofill", { method: "POST", json: { description } });
      // Only fill what the student has not already typed.
      if (!category) setCategory(suggestion.category);
      if (!title) setTitle(suggestion.title);
      if (!domain && suggestion.domain) setDomain(suggestion.domain);
      if (!targetRole && suggestion.targetRole) setTargetRole(suggestion.targetRole);
      if (!targetCompany && suggestion.targetCompany) setTargetCompany(suggestion.targetCompany);
      if (!location && suggestion.location) setLocation(suggestion.location);
      if (!workMode && suggestion.workMode) setWorkMode(suggestion.workMode);
      if (!deadline && suggestion.deadline) setDeadline(suggestion.deadline);
      setUrgency((current) => (current === "NORMAL" ? suggestion.urgency : current));
      setSkills((current) => [...current, ...suggestion.skills.filter((name) => !current.some((skill) => skill.name === name)).map((name): SkillRow => ({ name, importance: "MUST" }))].slice(0, 12));
      setNote(usedFallback ? "Filled in what we could spot. Please check every field." : "Fields suggested from your description. Please check every field.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fill the form.");
    } finally {
      setFilling(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ redirect: string }>("/api/asks", {
        method: "POST",
        json: {
          category: category || undefined,
          title,
          description,
          domain,
          targetRole,
          targetCompany,
          location,
          workMode: workMode || null,
          deadline: deadline || null,
          urgency,
          skills,
        },
      });
      // A full navigation: the new ask page must show fresh matches, and this is the most reliable way to land there.
      window.location.assign(result.redirect);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post your ask.");
      setBusy(false);
    }
  }

  const isReferral = category === "referral";

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-lime-soft px-4 py-3 text-sm">
        <strong>{quota.remaining}</strong> of {quota.limit} asks left this month. Be specific: the more precise your ask, the better your matches.
      </p>

      <section className="card space-y-5">
        <SelectField id="category" label="What kind of help do you need? *" value={category} onChange={setCategory} options={ASK_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))} />
        <TextAreaField id="description" label="Describe what you need *" rows={5} maxLength={2000} value={description} onChange={setDescription} help="Say who you are, what you want, and by when. Don't include phone numbers or emails." />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={autofill} disabled={filling || description.trim().length < 10} className="btn-ghost">{filling ? "Reading…" : "✨ Fill the fields from my description"}</button>
          {note && <span role="status" className="text-sm text-lime-dark">{note}</span>}
        </div>
      </section>

      <section className="card space-y-5">
        <TextField id="title" label="Title *" maxLength={120} value={title} onChange={setTitle} placeholder="Referral for data analyst roles in Bengaluru" />

        <Field label="Skills you need help with *" htmlFor="skill-draft" help="Skills you want to learn or get guidance on. Press Enter to add each one.">
          <input id="skill-draft" value={skillDraft} placeholder="e.g. sql" className={inputClass} onChange={(event) => setSkillDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addSkill(skillDraft); } }} onBlur={() => addSkill(skillDraft)} />
          {skills.length > 0 && (
            <ul className="mt-3 space-y-2">
              {skills.map((skill) => (
                <li key={skill.name} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{skill.name}</span>
                  <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => setSkills(skills.filter((item) => item.name !== skill.name))} className="px-2 text-muted hover:text-sun-dark">✕</button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="targetRole" label="Target role" value={targetRole} onChange={setTargetRole} placeholder="Data Analyst" />
          <TextField id="targetCompany" label={isReferral ? "Target company *" : "Target company"} value={targetCompany} onChange={setTargetCompany} />
          <TextField id="domain" label="Domain" value={domain} onChange={setDomain} placeholder="data analytics" />
          <TextField id="location" label="Location" value={location} onChange={setLocation} placeholder="Bengaluru" />
          <SelectField id="workMode" label="Work mode" value={workMode} onChange={setWorkMode} options={Object.entries(WORK_MODE_LABELS).map(([value, label]) => ({ value, label }))} />
          <TextField id="deadline" label="Needed by" type="date" value={deadline} onChange={setDeadline} />
          <SelectField id="urgency" label="Urgency" value={urgency} onChange={setUrgency} options={Object.entries(URGENCY_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
      <button type="button" onClick={submit} disabled={busy || quota.remaining <= 0} className="btn-primary">{busy ? "Finding your matches…" : "Post ask and see my top 3 ↗"}</button>
    </div>
  );
}
