import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { badRequest, forbidden, notFound } from "../errors";
import { extractResumeDraft, sanitizeResumeText } from "../ai/resume";
import { recordEvent } from "./audit";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
/** Where résumé PDFs live. Set RESUME_DIR to put them on a mounted volume (the Docker image does). */
export const resumeDir = () => path.resolve(process.env.RESUME_DIR?.trim() || path.join(process.cwd(), "storage", "resumes"));

function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").slice(0, 100);
  return base || "resume.pdf";
}

async function pdfText(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // Per-page text keeps line breaks, which the résumé reader relies on; merging pages would flatten them.
    const { text } = await extractText(pdf);
    return text.join("\n\n");
  } catch {
    return "";
  }
}

/**
 * Stores a PDF résumé for the user and returns an editable draft read from it.
 * Scanned or unreadable PDFs are still stored; the draft is then null and the member fills details in by hand.
 */
export async function uploadResume(user: SessionUser, file: { name: string; type: string; buffer: Buffer }) {
  if (user.role === "ADMIN") throw forbidden();
  if (file.buffer.length === 0) throw badRequest("The uploaded résumé is empty.");
  if (file.buffer.length > MAX_RESUME_BYTES) throw badRequest("The résumé must be 5 MB or smaller.");
  if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw badRequest("Only PDF résumés are supported.");

  const text = sanitizeResumeText(await pdfText(file.buffer));
  const readable = text.length >= 40;
  const extraction = readable ? await extractResumeDraft(user, text) : null;

  const resume = await db.resume.create({
    data: {
      userId: user.id,
      fileName: safeFileName(file.name),
      mime: "application/pdf",
      size: file.buffer.length,
      storagePath: "pending",
      extractedText: readable ? text : null,
      parsedJson: extraction ? JSON.stringify(extraction.draft) : null,
    },
  });
  const storagePath = `${resume.id}.pdf`;
  await mkdir(resumeDir(), { recursive: true });
  await writeFile(path.join(resumeDir(), storagePath), file.buffer);
  await db.resume.update({ where: { id: resume.id }, data: { storagePath } });

  if (user.role === "STUDENT") await db.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, resumeId: resume.id }, update: { resumeId: resume.id } });
  else await db.alumniProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, resumeId: resume.id }, update: { resumeId: resume.id } });

  await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "resume.uploaded", entity: "resume", entityId: resume.id, payload: { readable, usedFallback: extraction?.usedFallback ?? null } });

  return {
    resume: { id: resume.id, fileName: resume.fileName, size: resume.size },
    draft: extraction?.draft ?? null,
    usedFallback: extraction?.usedFallback ?? null,
    message: readable
      ? extraction?.usedFallback
        ? "We read what we could from your résumé. Please check and complete the details."
        : "We filled in what we found. Please check everything before continuing."
      : "We couldn't read text from this PDF (it may be a scan). Please fill in your details by hand.",
  };
}

/**
 * Returns a résumé file the user may open: the owner, or an alumnus who holds a live request from
 * that student (waiting, accepted or closed after acceptance). Other views are logged for the institute.
 */
export async function getResumeFile(user: SessionUser, resumeId: string) {
  const resume = await db.resume.findUnique({ where: { id: resumeId }, include: { user: { select: { instituteId: true } } } });
  if (!resume || resume.user.instituteId !== user.instituteId) throw notFound("Résumé not found.");

  if (resume.userId !== user.id) {
    const allowed =
      user.role === "ALUMNI" &&
      (await db.introRequest.count({ where: { alumniId: user.id, studentId: resume.userId, state: { in: ["PENDING", "ACCEPTED", "CLOSED"] } } })) > 0;
    if (!allowed) throw notFound("Résumé not found.");
    await recordEvent({ instituteId: user.instituteId, actorId: user.id, kind: "resume.viewed", entity: "resume", entityId: resume.id });
  }

  // basename() keeps older rows (which stored "storage/resumes/<id>.pdf") readable and stops path tricks.
  const buffer = await readFile(path.join(resumeDir(), path.basename(resume.storagePath))).catch(() => {
    throw notFound("Résumé file is missing.");
  });
  return { buffer, fileName: resume.fileName, mime: resume.mime };
}
