import { Logo, LogoMark } from "../Logo";

const PERKS = ["Emails and phone numbers stay private", "Alumni choose how many students to help", "Your institute is its own private space"];

/** Split screen: a playful brand panel on large screens, the form always in a roomy card. */
export function AuthCard({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(440px,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tone="light" size={36} />
        <div aria-hidden className="absolute -right-24 -top-20 h-72 w-72 animate-float rounded-full bg-lime" />
        <div aria-hidden className="absolute bottom-16 right-16 h-24 w-24 animate-float rounded-3xl bg-sun" style={{ "--r": "14deg", animationDelay: "-2s" } as React.CSSProperties} />
        <div aria-hidden className="absolute right-44 top-56 h-12 w-12 animate-float rounded-full bg-sky-soft" style={{ animationDelay: "-4s" } as React.CSSProperties} />
        <div className="relative">
          <h2 className="max-w-md font-display text-5xl font-extrabold leading-[0.95]">Follow the thread to the right person.</h2>
          <ul className="mt-8 space-y-3 text-base text-white/80">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-xs text-ink">✓</span>{perk}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">Threadline · Alumni Ask &amp; Resolve</p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <div className="card animate-pop">
            <LogoMark size={40} className="mb-4 hidden lg:block" />
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="mt-3 text-4xl font-extrabold leading-none">{title}</h1>
            {intro && <p className="mb-6 mt-3 text-sm text-muted">{intro}</p>}
            <div className={intro ? "" : "mt-6"}>{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
