import type { ResumeDraft } from "@/lib/ai/schemas";
import { toNumber } from "@/lib/client-api";
import type { EducationValue, ExperienceValue } from "./HistoryEditors";
import type { SkillValue } from "./SkillsEditor";

/** Shapes shared by both profile forms: server rows to editable values and back to API payloads. */

type ExperienceRow = { type: string; title: string; organisation: string | null; startDate: string | null; endDate: string | null; isCurrent: boolean; description: string | null };
type EducationRow = { institution: string; degree: string | null; field: string | null; startYear: number | null; endYear: number | null; grade: string | null };

export const experiencesFromRows = (rows: ExperienceRow[]): ExperienceValue[] =>
  rows.map((row) => ({
    type: row.type as ExperienceValue["type"],
    title: row.title,
    organisation: row.organisation ?? "",
    startDate: row.startDate ?? "",
    endDate: row.endDate ?? "",
    isCurrent: row.isCurrent,
    description: row.description ?? "",
  }));

export const educationsFromRows = (rows: EducationRow[]): EducationValue[] =>
  rows.map((row) => ({
    institution: row.institution,
    degree: row.degree ?? "",
    field: row.field ?? "",
    startYear: row.startYear?.toString() ?? "",
    endYear: row.endYear?.toString() ?? "",
    grade: row.grade ?? "",
  }));

const orNull = (value: string) => value.trim() || null;

/** Blank entries (no title / institution) are dropped; everything else is sent for server validation. */
export const experiencesToPayload = (items: ExperienceValue[]) =>
  items
    .filter((item) => item.title.trim() || item.organisation.trim())
    .map((item) => ({
      type: item.type,
      title: item.title.trim(),
      organisation: orNull(item.organisation),
      startDate: orNull(item.startDate),
      endDate: item.isCurrent ? null : orNull(item.endDate),
      isCurrent: item.isCurrent,
      description: orNull(item.description),
    }));

export const educationsToPayload = (items: EducationValue[]) =>
  items
    .filter((item) => item.institution.trim())
    .map((item) => ({
      institution: item.institution.trim(),
      degree: orNull(item.degree),
      field: orNull(item.field),
      startYear: toNumber(item.startYear),
      endYear: toNumber(item.endYear),
      grade: orNull(item.grade),
    }));

export const skillsToPayload = (skills: SkillValue[]) => skills.map((skill) => ({ name: skill.name, level: skill.level }));

/** Merges a résumé draft into the form without overwriting anything the member already typed. */
export function mergeDraft(
  current: { headline: string; experiences: ExperienceValue[]; educations: EducationValue[]; skills: SkillValue[] },
  draft: ResumeDraft,
) {
  const knownTitles = new Set(current.experiences.map((item) => `${item.title}|${item.organisation}`.toLowerCase()));
  const experiences = [
    ...current.experiences,
    ...draft.roles
      .filter((role) => !knownTitles.has(`${role.title}|${role.organisation ?? ""}`.toLowerCase()))
      .map((role): ExperienceValue => ({
        type: role.type,
        title: role.title,
        organisation: role.organisation ?? "",
        startDate: role.start ?? "",
        endDate: role.isCurrent ? "" : role.end ?? "",
        isCurrent: role.isCurrent,
        description: role.description ?? "",
      })),
  ];

  const knownInstitutions = new Set(current.educations.map((item) => item.institution.toLowerCase()));
  const educations = [
    ...current.educations,
    ...draft.education
      .filter((entry) => !knownInstitutions.has(entry.institution.toLowerCase()))
      .map((entry): EducationValue => ({
        institution: entry.institution,
        degree: entry.degree ?? "",
        field: entry.field ?? "",
        startYear: entry.startYear?.toString() ?? "",
        endYear: entry.endYear?.toString() ?? "",
        grade: "",
      })),
  ];

  const knownSkills = new Set(current.skills.map((skill) => skill.name));
  const skills = [
    ...current.skills,
    ...draft.skills.filter((name) => !knownSkills.has(name)).map((name): SkillValue => ({ name, level: "INTERMEDIATE" })),
  ].slice(0, 40);

  return { headline: current.headline || draft.headline || "", experiences, educations, skills };
}
