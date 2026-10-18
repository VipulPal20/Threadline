"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASK_CATEGORIES, LIMITS } from "@/lib/domain/constants";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import { api, toNumber } from "@/lib/client-api";
import type { AlumniProfileView } from "@/lib/services/profiles";
import { ChipInput } from "../ui/ChipInput";
import { NumberField, SelectField, TextAreaField, TextField } from "../ui/fields";
import { EducationEditor, ExperienceEditor, type EducationValue, type ExperienceValue } from "./HistoryEditors";
import { ResumeUpload, type ResumeInfo } from "./ResumeUpload";
import { SkillsEditor, type SkillValue } from "./SkillsEditor";
import { Wizard, type WizardStep } from "./Wizard";
import { educationsFromRows, educationsToPayload, experiencesFromRows, experiencesToPayload, mergeDraft, skillsToPayload } from "./mapping";


function fromView(view: AlumniProfileView) {
  const { profile } = view;
  return {
    name: view.user.name,
    phone: view.user.phone ?? "",
    department: profile.department ?? "",
    degree: profile.degree ?? "",
    graduationYear: profile.graduationYear?.toString() ?? "",
    currentCompany: profile.currentCompany ?? "",
    currentTitle: profile.currentTitle ?? "",
    industry: profile.industry ?? "",
    yearsExperience: profile.yearsExperience?.toString() ?? "",
    city: profile.city ?? "",
    workMode: profile.workMode ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    helpTypes: profile.helpTypes,
    referralCompanies: profile.referralCompanies,
    linkedinUrl: profile.linkedinUrl ?? "",
    maxActiveConnections: profile.maxActiveConnections.toString(),
    acceptingRequests: profile.acceptingRequests,
    experiences: experiencesFromRows(view.experiences),
    educations: educationsFromRows(view.educations),
    skills: view.skills.map((skill): SkillValue => ({ name: skill.name, level: skill.level as SkillValue["level"] })),
  };
}

type Form = ReturnType<typeof fromView>;
const orNull = (value: string) => value.trim() || null;

function toPayload(form: Form, submit: boolean) {
  return {
    ...(form.name.trim().length >= 2 ? { name: form.name.trim() } : {}),
    phone: orNull(form.phone),
    department: orNull(form.department),
    degree: orNull(form.degree),
    graduationYear: toNumber(form.graduationYear),
    currentCompany: orNull(form.currentCompany),
    currentTitle: orNull(form.currentTitle),
    industry: orNull(form.industry),
    yearsExperience: toNumber(form.yearsExperience),
    city: orNull(form.city),
    workMode: form.workMode || null,
    headline: orNull(form.headline),
    bio: orNull(form.bio),
    helpTypes: form.helpTypes,
    referralCompanies: form.referralCompanies,
    linkedinUrl: orNull(form.linkedinUrl),
    maxActiveConnections: toNumber(form.maxActiveConnections) ?? undefined,
    acceptingRequests: form.acceptingRequests,
    experiences: experiencesToPayload(form.experiences),
    educations: educationsToPayload(form.educations),
    skills: skillsToPayload(form.skills),
    submit,
  };
}

export function AlumniProfileForm({ initial, mode }: { initial: AlumniProfileView; mode: "wizard" | "page" }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => fromView(initial));
  const [resume, setResume] = useState<ResumeInfo | null>(initial.resume);
  const [completeness, setCompleteness] = useState(initial.completeness);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(submit: boolean) {
    const view = await api<AlumniProfileView>("/api/me/profile", { method: "PUT", json: toPayload(form, submit) });
    setCompleteness(view.completeness);
  }

  const toggleHelp = (type: string) =>
    set("helpTypes", form.helpTypes.includes(type) ? form.helpTypes.filter((item) => item !== type) : [...form.helpTypes, type]);

  const steps: WizardStep[] = [
    {
      id: "basics",
      title: "About you",
      description: "Students from your institute will see your name, role and background. Your email and phone number are never shown to anyone.",
      render: () => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="name" label="Full name" value={form.name} onChange={(v) => set("name", v)} />
          <TextField id="phone" label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <TextField id="department" label="Department studied" value={form.department} onChange={(v) => set("department", v)} placeholder="Computer Science" />
          <TextField id="degree" label="Degree" value={form.degree} onChange={(v) => set("degree", v)} placeholder="B.Tech" />
          <NumberField id="graduationYear" label="Graduation year" min={1950} max={2100} value={form.graduationYear} onChange={(v) => set("graduationYear", v)} />
          <TextField id="linkedinUrl" label="LinkedIn" type="url" placeholder="https://linkedin.com/in/…" value={form.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} />
        </div>
      ),
    },
    {
      id: "work",
      title: "Where you work",
      render: () => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="currentCompany" label="Current company" value={form.currentCompany} onChange={(v) => set("currentCompany", v)} />
            <TextField id="currentTitle" label="Job title" value={form.currentTitle} onChange={(v) => set("currentTitle", v)} />
            <TextField id="industry" label="Industry / domain" value={form.industry} onChange={(v) => set("industry", v)} placeholder="data analytics" />
            <NumberField id="yearsExperience" label="Years of experience" min={0} max={60} value={form.yearsExperience} onChange={(v) => set("yearsExperience", v)} />
            <TextField id="city" label="City" value={form.city} onChange={(v) => set("city", v)} />
            <SelectField id="workMode" label="Work mode" value={form.workMode} onChange={(v) => set("workMode", v)} options={[{ value: "ONSITE", label: "On-site" }, { value: "HYBRID", label: "Hybrid" }, { value: "REMOTE", label: "Remote" }]} />
          </div>
          <TextField id="headline" label="Headline" maxLength={120} value={form.headline} onChange={(v) => set("headline", v)} placeholder="Data analyst at Northstar Labs" />
          <TextAreaField id="bio" label="About you" maxLength={1500} value={form.bio} onChange={(v) => set("bio", v)} />
        </div>
      ),
    },
    {
      id: "history",
      title: "Experience and education",
      description: "Optional: upload a résumé to prefill, then edit.",
      render: () => (
        <div className="space-y-8">
          <ResumeUpload
            resume={resume}
            onUploaded={(info, draft) => {
              setResume(info);
              if (draft) setForm((current) => ({ ...current, ...mergeDraft(current, draft) }));
            }}
          />
          <div className="space-y-3"><h3 className="font-semibold">Experience</h3><ExperienceEditor prefix="aexp" value={form.experiences} onChange={(v: ExperienceValue[]) => set("experiences", v)} /></div>
          <div className="space-y-3"><h3 className="font-semibold">Education</h3><EducationEditor prefix="aedu" value={form.educations} onChange={(v: EducationValue[]) => set("educations", v)} /></div>
        </div>
      ),
    },
    {
      id: "skills",
      title: "Skills and expertise",
      description: "Students are matched to you on these. Add at least three.",
      render: () => <SkillsEditor value={form.skills} onChange={(v) => set("skills", v)} />,
    },
    {
      id: "help",
      title: "How you can help",
      render: () => (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold normal-case tracking-normal text-ink">I can help with *</legend>
            <div className="flex flex-wrap gap-2">
              {ASK_CATEGORIES.map((type) => (
                <label key={type} className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm ${form.helpTypes.includes(type) ? "border-lime-dark bg-lime-soft" : "border-line bg-white"}`}>
                  <input type="checkbox" className="sr-only" checked={form.helpTypes.includes(type)} onChange={() => toggleHelp(type)} />
                  {CATEGORY_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <ChipInput id="referralCompanies" label="Companies you can refer people to" help={`Defaults to your current company. Press Enter to add (up to 10).`} value={form.referralCompanies} onChange={(v) => set("referralCompanies", v)} max={10} />
        </div>
      ),
    },
    {
      id: "capacity",
      title: "Your capacity",
      description: "Only you can see this. It is used to make sure you never get more requests than you can handle.",
      render: () => (
        <div className="space-y-4">
          <NumberField
            id="maxActiveConnections"
            label="How many students can you actively help at once?"
            min={LIMITS.minAlumniCapacity}
            max={LIMITS.maxAlumniCapacity}
            help={`Choose ${LIMITS.minAlumniCapacity} to ${LIMITS.maxAlumniCapacity}. Once you reach it, you stop appearing to new students until a conversation is resolved. You can change it any time under Settings.`}
            value={form.maxActiveConnections}
            onChange={(v) => set("maxActiveConnections", v)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.acceptingRequests} onChange={(event) => set("acceptingRequests", event.target.checked)} />
            I am open to new requests
          </label>
        </div>
      ),
    },
    {
      id: "review",
      title: "Review and finish",
      render: () => (
        <div className="space-y-3 text-sm">
          <p>Your profile is <strong>{completeness.percent}%</strong> complete.</p>
          {completeness.missing.length > 0 ? (
            <div className="rounded-xl bg-sun-soft p-4 text-sun-dark">
              <p className="font-semibold">Still needed before you can finish:</p>
              <ul className="mt-1 list-disc pl-5">{completeness.missing.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="mt-2">Use Back to fill these in.</p>
            </div>
          ) : (
            <p className="rounded-xl bg-lime-soft p-4">Everything required is filled in. Requests from students will appear on your dashboard.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <Wizard
      mode={mode}
      steps={mode === "page" ? steps.filter((step) => step.id !== "review") : steps}
      onSave={save}
      onDone={() => {
        router.push("/alumni/dashboard");
        router.refresh();
      }}
      submitLabel="Finish and go to my dashboard"
      percent={completeness.percent}
    />
  );
}
