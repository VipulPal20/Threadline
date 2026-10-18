"use client";

import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { useEffect } from "react";

/** Last-resort error screen. The details stay in the server log; people only see a calm message. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-[min(460px,calc(100%-32px))] flex-col justify-center py-12">
      <div role="alert" className="card animate-pop space-y-4">
        <LogoMark size={48} className="animate-wiggle" />
        <span className="eyebrow">something went wrong</span>
        <h1 className="text-4xl font-extrabold leading-none">That didn&apos;t work</h1>
        <p className="text-sm text-muted">It&apos;s on our side, not yours. Try again, and if it keeps happening, tell your institute admin{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn-dark">Try again</button>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    </main>
  );
}
