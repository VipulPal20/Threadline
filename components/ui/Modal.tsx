"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Accessible modal built on the native <dialog>: focus trap, Escape to close and a backdrop for free. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className="w-[min(640px,calc(100%-24px))] rounded-2xl border border-line bg-white p-0 shadow-lift backdrop:bg-ink/40"
    >
      {open && (
        <div className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 text-xl text-muted hover:text-ink">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
