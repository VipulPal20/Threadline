"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import type { NavItem } from "./AppShell";

/** Sticky app navbar: tucks away while scrolling down, returns on scroll up, and marks the current page. */
export function AppHeader({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (Math.abs(y - last) > 8) {
        setHidden(y > last && y > 120);
        last = y;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const link = (item: NavItem, extra: string) => (
    <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`rounded-full text-sm transition duration-200 active:scale-95 ${isActive(item.href) ? "bg-ink text-white" : "text-muted hover:bg-lime hover:text-ink"} ${extra}`}>
      {item.label}
    </Link>
  );

  return (
    <header className={`sticky top-0 z-20 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"} ${scrolled ? "bg-paper/95 shadow-card backdrop-blur" : "bg-paper"}`}>
      <div className="mx-auto flex h-16 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
        <Logo size={30} />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">{nav.map((item) => link(item, "px-3.5 py-2"))}</nav>
        <div className="flex items-center gap-3">{children}</div>
      </div>
      <nav aria-label="Main (mobile)" className="mx-auto flex w-[min(1180px,calc(100%-32px))] flex-wrap gap-1 pb-2 md:hidden">{nav.map((item) => link(item, "px-3 py-2.5"))}</nav>
    </header>
  );
}
