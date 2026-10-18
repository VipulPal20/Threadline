import Link from "next/link";

/** The Threadline mark: a T drawn as one thread. The wavy bar joins two people (lime and orange nodes); the stem is the line that follows. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Threadline" className={className}>
      <rect width="40" height="40" rx="12" fill="#172019" />
      <path d="M8 14 C13 7, 17 21, 22 14 S30 8, 32 13" fill="none" stroke="#b8d830" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20 17 V31" fill="none" stroke="#b8d830" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="8" cy="14" r="3.4" fill="#f07d35" />
      <circle cx="32" cy="13" r="3.4" fill="#b8d830" />
      <circle cx="20" cy="31.5" r="2.6" fill="#fff" />
    </svg>
  );
}

/** Mark plus wordmark, linking home. `tone="light"` is for dark backgrounds. */
export function Logo({ size = 32, tone = "dark", href = "/", className = "" }: { size?: number; tone?: "dark" | "light"; href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Threadline home" className={`group inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight ${tone === "light" ? "text-white" : "text-ink"} ${className}`}>
      <LogoMark size={size} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      <span>threadline</span>
    </Link>
  );
}
