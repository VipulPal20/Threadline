import fs from "node:fs";
import path from "node:path";

export type SkillCounts = Record<string, number>;
export type SkillsByCategory = Record<string, SkillCounts>;

/** Team-curated fallback used when no licensed résumé export is supplied. */
export const CURATED_SKILLS: SkillsByCategory = {
  "data analytics": { sql: 10, python: 9, "data analytics": 8, "power bi": 7, excel: 5, statistics: 6, tableau: 5, "data visualization": 5 },
  "software engineering": { typescript: 9, javascript: 8, react: 8, python: 7, "system design": 7, testing: 5, "api design": 5, cloud: 6 },
  "machine learning": { python: 10, "machine learning": 9, statistics: 7, pandas: 7, "scikit-learn": 6, "data visualization": 4, "deep learning": 6, sql: 4 },
  "product management": { product: 10, "user research": 7, roadmapping: 7, analytics: 6, communication: 5, experimentation: 5, strategy: 6, sql: 4 },
  "semiconductor systems": { "vlsi design": 10, semiconductors: 9, verilog: 8, "embedded systems": 7, "digital design": 7, "signal processing": 5, python: 4, research: 5 },
  research: { research: 10, "technical writing": 7, python: 7, experimentation: 7, "literature review": 6, statistics: 6, presentation: 5, "machine learning": 5 },
  entrepreneurship: { startups: 9, funding: 9, product: 8, strategy: 7, sales: 6, hiring: 6, communication: 5, "business models": 5 },
  design: { "product design": 9, "user research": 8, figma: 8, prototyping: 7, "visual design": 7, communication: 5, "design systems": 6, usability: 6 },
};

export interface ResumeRecord {
  category?: string;
  Resume_str?: string;
  resume?: string;
  text?: string;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

/** Count curated skill phrases in records without retaining résumé text. */
export function buildVocabulary(records: readonly ResumeRecord[] = []): SkillsByCategory {
  const result: SkillsByCategory = Object.fromEntries(
    Object.entries(CURATED_SKILLS).map(([category, skills]) => [category, { ...skills }]),
  );

  for (const record of records) {
    const category = normalise(record.category ?? "");
    if (!category || !result[category]) continue;
    const text = normalise(record.Resume_str ?? record.resume ?? record.text ?? "");
    if (!text) continue;
    for (const skill of Object.keys(result[category])) {
      const occurrences = text.split(normalise(skill)).length - 1;
      if (occurrences > 0) result[category][skill] += occurrences;
    }
  }

  return result;
}

export function writeVocabulary(destination: string, records: readonly ResumeRecord[] = []): SkillsByCategory {
  const vocabulary = buildVocabulary(records);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(vocabulary, null, 2)}\n`, "utf8");
  return vocabulary;
}

export function main(argv = process.argv.slice(2)): void {
  const inputPath = argv[0];
  const outputPath = argv[1] ?? path.resolve(process.cwd(), "data/vocab/skills-by-category.json");
  let records: ResumeRecord[] = [];
  if (inputPath) {
    const parsed: unknown = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    records = Array.isArray(parsed) ? parsed as ResumeRecord[] : [];
  }
  writeVocabulary(outputPath, records);
}

if (process.argv[1]?.endsWith("build-vocab.ts")) main();
