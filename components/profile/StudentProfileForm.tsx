"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, toNumber } from "@/lib/client-api";
import type { StudentProfileView } from "@/lib/services/profiles";
import { ChipInput } from "../ui/ChipInput";
import { NumberField, TextAreaField, TextField } from "../ui/fields";
import { EducationEditor, ExperienceEditor, type EducationValue, type ExperienceValue } from "./HistoryEditors";
import { ResumeUpload, type ResumeInfo } from "./ResumeUpload";
import { SkillsEditor, type SkillValue } from "./SkillsEditor";
import { Wizard, type WizardStep } from "./Wizard";
import { educationsFromRows, educationsToPayload, experiencesFromRows, experiencesToPayload, mergeDraft, skillsToPayload } from "./mapping";

function fromView(view: StudentProfileView) {
  const { profile } = view;
  return {
    name: view.user.name,
    phone: view.user.phone ?? "",
    enrollmentNo: profile.enrollmentNo ?? "",
    department: profile.department ?? "",
    degree: profile.degree ?? "",
    currentYear: profile.currentYear?.toString() ?? "",
    graduationYear: profile.graduationYear?.toString() ?? "",
    cgpa: profile.cgpa?.toString() ?? "",
    city: profile.city ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    targetRoles: profile.targetRoles,
    targetCompanies: profile.targetCompanies,
    interestedDomains: profile.interestedDomains,
    preferredLocations: profile.preferredLocations,
    linkedinUrl: profile.linkedinUrl ?? "",
    githubUrl: profile.githubUrl ?? "",
    portfolioUrl: profile.portfolioUrl ?? "",
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
    enrollmentNo: orNull(form.enrollmentNo),
    department: orNull(form.department),
    degree: orNull(form.degree),
    currentYear: toNumber(form.currentYear),
    graduationYear: toNumber(form.graduationYear),
    cgpa: toNumber(form.cgpa),
    city: orNull(form.city),
    headline: orNull(form.headline),
    bio: orNull(form.bio),
    targetRoles: form.targetRoles,
    targetCompanies: form.targetCompanies,
    interestedDomains: form.interestedDomains,
    preferredLocations: form.preferredLocations,
    linkedinUrl: orNull(form.linkedinUrl),
    githubUrl: orNull(form.githubUrl),
    portfolioUrl: orNull(form.portfolioUrl),
    experiences: experiencesToPayload(form.experiences),
    educations: educationsToPayload(form.educations),
    skills: skillsToPayload(form.skills),
    submit,
  };
}

export function StudentProfileForm({ initial, mode }: { initial: StudentProfileView; mode: "wizard" | "page" }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => fromView(initial));
  const [resume, setResume] = useState<ResumeInfo | null>(initial.resume);
  const [completeness, setCompleteness] = useState(initial.completeness);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(submit: boolean) {
    const view = await api<StudentProfileView>("/api/me/profile", { method: "PUT", json: toPayload(form, submit) });
    setCompleteness(view.completeness);
  }

  const steps: WizardStep[] = [
    {
      id: "basics",
      title: "About you",
      description: "The basics alumni will see when you ask for help. Your phone number is never shown before someone accepts.",
      render: () => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="name" label="Full name" value={form.name} onChange={(v) => set("name", v)} />
          <TextField id="phone" label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <TextField id="enrollmentNo" label="Enrollment number" value={form.enrollmentNo} onChange={(v) => set("enrollmentNo", v)} />
          <TextField id="department" label="Department" value={form.department} onChange={(v) => set("department", v)} placeholder="Computer Science" />
          <TextField id="degree" label="Degree" value={form.degree} onChange={(v) => set("degree", v)} placeholder="B.Tech" />
          <TextField id="city" label="City" value={form.city} onChange={(v) => set("city", v)} />
          <NumberField id="currentYear" label="Current year of study" min={1} max={8} value={form.currentYear} onChange={(v) => set("currentYear", v)} />
          <NumberField id="graduationYear" label="Graduation year" min={2000} max={2100} value={form.graduationYear} onChange={(v) => set("graduationYear", v)} />
          <NumberField id="cgpa" label="CGPA (optional)" min={0} max={10} step={0.01} value={form.cgpa} onChange={(v) => set("cgpa", v)} />
        </div>
      ),
    },
    {
      id: "resume",
      title: "Your résumé",
      description: "Upload it once and we prefill the next steps. You can edit everything.",
      render: () => (
        <ResumeUpload
          required
          resume={resume}
          onUploaded={(info, draft) => {
            setResume(info);
            if (draft) setForm((current) => ({ ...current, ...mergeDraft(current, draft) }));
          }}
        />
      ),
    },
    {
      id: "history",
      title: "Education and experience",
      description: "Internships, projects and jobs. Add anything that shows what you can do.",
      render: () => (
        <div className="space-y-8">
          <div className="space-y-3"><h3 className="font-semibold">Education</h3><EducationEditor value={form.educations} onChange={(v: EducationValue[]) => set("educations", v)} /></div>
          <div className="space-y-3"><h3 className="font-semibold">Experience and projects</h3><ExperienceEditor value={form.experiences} onChange={(v: ExperienceValue[]) => set("experiences", v)} /></div>
        </div>
      ),
    },
    {
      id: "skills",
      title: "Skills",
      description: "Add at least three. Your top matches are scored on these.",
      render: () => <SkillsEditor value={form.skills} onChange={(v) => set("skills", v)} />,
    },
    {
      id: "goals",
      title: "Goals",
      description: "Where you want to go helps us pick alumni who have been there.",
      render: () => (
        <div className="space-y-4">
          <TextField id="headline" label="Headline" maxLength={120} value={form.headline} onChange={(v) => set("headline", v)} placeholder="Final-year CS student exploring data analytics" />
          <TextAreaField id="bio" label="About you" maxLength={1500} value={form.bio} onChange={(v) => set("bio", v)} />
          <ChipInput id="targetRoles" label="Roles you are aiming for *" value={form.targetRoles} onChange={(v) => set("targetRoles", v)} placeholder="Data Analyst" max={8} />
          <ChipInput id="targetCompanies" label="Companies you are interested in" value={form.targetCompanies} onChange={(v) => set("targetCompanies", v)} max={10} />
          <ChipInput id="interestedDomains" label="Domains" value={form.interestedDomains} onChange={(v) => set("interestedDomains", v)} placeholder="data analytics" max={8} />
          <ChipInput id="preferredLocations" label="Preferred locations" value={form.preferredLocations} onChange={(v) => set("preferredLocations", v)} max={8} />
        </div>
      ),
    },
    {
      id: "links",
      title: "Links",
      description: "Optional, but alumni like to see your work.",
      render: () => (
        <div className="space-y-4">
          <TextField id="linkedinUrl" label="LinkedIn" type="url" placeholder="https://linkedin.com/in/…" value={form.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} />
          <TextField id="githubUrl" label="GitHub" type="url" placeholder="https://github.com/…" value={form.githubUrl} onChange={(v) => set("githubUrl", v)} />
          <TextField id="portfolioUrl" label="Portfolio" type="url" placeholder="https://…" value={form.portfolioUrl} onChange={(v) => set("portfolioUrl", v)} />
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
            <p className="rounded-xl bg-lime-soft p-4">Everything required is filled in. You can change any of this later from your profile page.</p>
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
        router.push("/student/dashboard");
        router.refresh();
      }}
      submitLabel="Finish and go to my dashboard"
      percent={completeness.percent}
    />
  );
}
