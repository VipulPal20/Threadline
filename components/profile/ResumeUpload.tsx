"use client";

import { useState } from "react";
import type { ResumeDraft } from "@/lib/ai/schemas";
import { api } from "@/lib/client-api";

export interface ResumeInfo {
  id: string;
  fileName: string;
  size: number;
}

interface UploadResponse {
  resume: ResumeInfo;
  draft: ResumeDraft | null;
  message: string;
}

export function ResumeUpload({ resume, onUploaded, required = false }: { resume: ResumeInfo | null; onUploaded: (resume: ResumeInfo, draft: ResumeDraft | null) => void; required?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await api<UploadResponse>("/api/me/resume", { method: "POST", body: form });
      setMessage(result.message);
      onUploaded(result.resume, result.draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-line bg-white p-5">
      <div>
        <p className="font-semibold">Résumé (PDF, up to 5 MB){required && <span className="text-sun-dark"> *</span>}</p>
        <p className="text-sm text-muted">We read it to prefill your details. Phone numbers, emails and links are removed before any AI sees the text. You review everything.</p>
      </div>
      {resume && (
        <p className="text-sm">
          Uploaded: <a href={`/api/resumes/${resume.id}`} target="_blank" rel="noreferrer" className="font-semibold underline">{resume.fileName}</a>
        </p>
      )}
      <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} className="block text-sm" aria-label="Upload résumé" />
      {busy && <p className="text-sm text-muted">Reading your résumé…</p>}
      {message && <p role="status" className="rounded-xl bg-lime-soft px-3.5 py-3 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-3 text-sm text-sun-dark">{error}</p>}
    </div>
  );
}
