"use client";

import { NumberField, SelectField, TextAreaField, TextField } from "../ui/fields";

export interface ExperienceValue {
  type: "JOB" | "INTERNSHIP" | "PROJECT";
  title: string;
  organisation: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
}

export interface EducationValue {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  grade: string;
}

export const emptyExperience = (): ExperienceValue => ({ type: "JOB", title: "", organisation: "", startDate: "", endDate: "", isCurrent: false, description: "" });
export const emptyEducation = (): EducationValue => ({ institution: "", degree: "", field: "", startYear: "", endYear: "", grade: "" });

function move<T>(items: T[], index: number, next: T | null): T[] {
  return items.flatMap((item, position) => (position === index ? (next === null ? [] : [next]) : [item]));
}

export function ExperienceEditor({ value, onChange, prefix = "exp" }: { value: ExperienceValue[]; onChange: (value: ExperienceValue[]) => void; prefix?: string }) {
  return (
    <div className="space-y-4">
      {value.map((item, index) => {
        const set = (patch: Partial<ExperienceValue>) => onChange(move(value, index, { ...item, ...patch }));
        const id = `${prefix}-${index}`;
        return (
          <div key={id} className="space-y-4 rounded-xl border border-line bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id={`${id}-title`} label="Title" value={item.title} onChange={(title) => set({ title })} />
              <TextField id={`${id}-org`} label="Company / organisation" value={item.organisation} onChange={(organisation) => set({ organisation })} />
              <SelectField id={`${id}-type`} label="Type" value={item.type} onChange={(type) => set({ type: (type || "JOB") as ExperienceValue["type"] })} options={[{ value: "JOB", label: "Job" }, { value: "INTERNSHIP", label: "Internship" }, { value: "PROJECT", label: "Project" }]} />
              <div className="grid grid-cols-2 gap-4">
                <TextField id={`${id}-start`} label="Start" placeholder="2023-06" value={item.startDate} onChange={(startDate) => set({ startDate })} />
                <TextField id={`${id}-end`} label="End" placeholder="2024-01" value={item.isCurrent ? "" : item.endDate} onChange={(endDate) => set({ endDate })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isCurrent} onChange={(event) => set({ isCurrent: event.target.checked })} /> I currently do this
            </label>
            <TextAreaField id={`${id}-desc`} label="What you did" rows={3} maxLength={1000} value={item.description} onChange={(description) => set({ description })} />
            <button type="button" onClick={() => onChange(move(value, index, null))} className="text-sm text-sun-dark underline">Remove</button>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...value, emptyExperience()])} className="btn-ghost">+ Add experience</button>
    </div>
  );
}

export function EducationEditor({ value, onChange, prefix = "edu" }: { value: EducationValue[]; onChange: (value: EducationValue[]) => void; prefix?: string }) {
  return (
    <div className="space-y-4">
      {value.map((item, index) => {
        const set = (patch: Partial<EducationValue>) => onChange(move(value, index, { ...item, ...patch }));
        const id = `${prefix}-${index}`;
        return (
          <div key={id} className="space-y-4 rounded-xl border border-line bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id={`${id}-inst`} label="Institution" value={item.institution} onChange={(institution) => set({ institution })} />
              <TextField id={`${id}-degree`} label="Degree" value={item.degree} onChange={(degree) => set({ degree })} />
              <TextField id={`${id}-field`} label="Field of study" value={item.field} onChange={(field) => set({ field })} />
              <TextField id={`${id}-grade`} label="Grade" value={item.grade} onChange={(grade) => set({ grade })} />
              <NumberField id={`${id}-start`} label="Start year" value={item.startYear} onChange={(startYear) => set({ startYear })} />
              <NumberField id={`${id}-end`} label="End year" value={item.endYear} onChange={(endYear) => set({ endYear })} />
            </div>
            <button type="button" onClick={() => onChange(move(value, index, null))} className="text-sm text-sun-dark underline">Remove</button>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...value, emptyEducation()])} className="btn-ghost">+ Add education</button>
    </div>
  );
}
