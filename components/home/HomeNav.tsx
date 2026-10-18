"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "../Logo";

const LINKS = [
  { id: "how", label: "How it works" },
  { id: "try", label: "Try matching" },
  { id: "roles", label: "Who it's for" },
  { id: "promises", label: "Privacy" },
];

/** Floating navbar: hides while scrolling down, returns on scroll up, shows a progress bar and highlights the section in view. */
export function HomeNav() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 12);
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
      if (Math.abs(y - last) > 8) {
        setHidden(y > last && y > 160);
        last = y;
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    LINKS.forEach((link) => {
      const node = document.getElementById(link.id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 ${hidden && !open ? "-translate-y-full" : "translate-y-0"}`}>
      <div className={`mx-auto mt-3 flex h-14 w-[min(1100px,calc(100%-24px))] items-center justify-between rounded-full px-4 transition-all duration-300 ${scrolled ? "bg-ink/95 text-white shadow-lift backdrop-blur" : "bg-white/70 backdrop-blur"}`}>
        <Logo size={30} tone={scrolled ? "light" : "dark"} />
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} className={`rounded-full px-3.5 py-1.5 text-sm transition ${active === link.id ? "bg-lime text-ink" : scrolled ? "text-white/75 hover:text-white" : "text-muted hover:text-ink"}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login/student" className={`btn px-4 py-2 ${scrolled ? "bg-lime text-ink" : "bg-ink text-white"}`}>Sign in</Link>
          <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-full bg-lime text-ink md:hidden">
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Sections (mobile)" className="mx-auto mt-2 flex w-[min(1100px,calc(100%-24px))] animate-pop flex-col gap-1 rounded-3xl bg-ink p-3 text-white md:hidden">
          {LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-base hover:bg-white/10">{link.label}</a>
          ))}
          <Link href="/register/institute" className="btn-primary mt-1">Register your institute</Link>
        </nav>
      )}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left bg-lime" style={{ transform: `scaleX(${progress})` }} />
    </header>
  );
}
