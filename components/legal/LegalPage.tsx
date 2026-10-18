import Link from "next/link";
import { Logo } from "../Logo";
import { TERMS_VERSION } from "@/lib/domain/legal";

export interface LegalSection {
  heading: string;
  body: string[];
}

/** A readable long-form page for the Terms and Privacy Policy. */
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 w-[min(760px,calc(100%-32px))] items-center justify-between">
        <Logo />
        <Link href="/" className="btn-ghost px-4 py-2">Home</Link>
      </header>
      <main className="mx-auto w-[min(760px,calc(100%-32px))] py-12">
        <h1 className="text-5xl font-extrabold leading-none md:text-6xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Version {TERMS_VERSION}</p>
        <p className="mt-6 text-lg">{intro}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-muted">
          <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </main>
    </div>
  );
}
