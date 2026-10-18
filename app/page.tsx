import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HomeNav } from "@/components/home/HomeNav";
import { MatchDemo } from "@/components/home/MatchDemo";
import { Reveal } from "@/components/home/Reveal";
import { Tilt } from "@/components/home/Tilt";

const steps = [
  { n: "1", title: "Post an ask", body: "Say what you need, the skills involved and any deadline. Your profile and résumé give alumni context.", tone: "bg-lime" },
  { n: "2", title: "See your top three", body: "Every alumnus is scored on skills, role, background and how responsive they are. You see why each one fits.", tone: "bg-sun-soft" },
  { n: "3", title: "They say yes or no", body: "A drafted message goes to the one you pick. Alumni accept only if they have time. Nobody is chased.", tone: "bg-sky-soft" },
  { n: "4", title: "Talk, then resolve", body: "Chat in the app with an AI helper if you get stuck. Mark the ask resolved and rate the help.", tone: "bg-white" },
];

const roles = [
  { title: "Students", body: "Build your profile, post what you need and meet the three alumni best placed to help.", login: "/login/student", join: "/register/student", cta: "Student sign in", tone: "bg-lime", rotate: "-1.5deg" },
  { title: "Alumni", body: "Share where you work and how many students you can help. Pause any time. Busy alumni are never shown.", login: "/login/alumni", join: "/register/alumni", cta: "Alumni sign in", tone: "bg-sky-soft", rotate: "1deg" },
  { title: "Institutes", body: "Invite members, approve alumni and track every ask from posted to resolved, without reading anyone's messages.", login: "/login/admin", join: "/register/institute", cta: "Admin sign in", tone: "bg-sun-soft", rotate: "-0.5deg" },
];

const promises = [
  { title: "Private by design", body: "Emails and phone numbers are never shown to other users. Conversations happen in the app." },
  { title: "Alumni stay in control", body: "Set your own limit. Reach it and you drop out of rankings until you have room." },
  { title: "Your institute only", body: "Each institute is its own space. Members never see another institute's people or data." },
  { title: "Numbers, not messages", body: "Admins see counts, response times and resolution rates. Message text stays between two people." },
];

const MARQUEE = ["Referrals", "Mock interviews", "Career advice", "Resume feedback", "Mentorship", "Internships", "Switching fields", "Higher studies"];

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      <HomeNav />

      <main>
        {/* Hero */}
        <section className="relative mx-auto flex min-h-[92vh] w-[min(1100px,calc(100%-32px))] flex-col justify-center pb-16 pt-32">
          <div aria-hidden className="pointer-events-none absolute right-0 top-28 hidden h-64 w-64 animate-float rounded-full bg-lime md:block" style={{ "--r": "0deg" } as React.CSSProperties} />
          <div aria-hidden className="pointer-events-none absolute right-40 top-[26rem] hidden h-24 w-24 animate-float rounded-3xl bg-sun md:block" style={{ "--r": "12deg", animationDelay: "-2s" } as React.CSSProperties} />
          <div aria-hidden className="pointer-events-none absolute right-8 top-[30rem] hidden h-16 w-16 animate-float rounded-full bg-sky-dark md:block" style={{ "--r": "0deg", animationDelay: "-4s" } as React.CSSProperties} />
          <Reveal>
            <h1 className="relative max-w-4xl text-6xl font-extrabold leading-[0.92] md:text-8xl">
              Ask once.<br />Meet the <span className="inline-block -rotate-2 rounded-2xl bg-lime px-3">right</span> alum.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 max-w-xl text-xl">
              Students post what they need. We rank every alumnus on skills and fit, show the best three, and open a chat only when they say yes.
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-10 flex flex-wrap gap-3">
            <Link href="/register/institute" className="btn-dark px-7 py-4 text-base">Register your institute</Link>
            <a href="#try" className="btn-ghost px-7 py-4 text-base">Try the matching ↓</a>
          </Reveal>
        </section>

        {/* Moving ribbon */}
        <div aria-hidden className="-rotate-1 overflow-hidden bg-ink py-4 text-white">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-2xl font-bold">
            {[...MARQUEE, ...MARQUEE].map((item, index) => (
              <span key={index} className="flex items-center gap-10">{item}<span className="text-lime">✦</span></span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="mx-auto w-[min(1100px,calc(100%-32px))] scroll-mt-4 py-32">
          <Reveal>
            <h2 className="max-w-2xl text-5xl font-extrabold leading-[0.95] md:text-6xl">From a question to a resolved ask.</h2>
          </Reveal>
          <ol className="mt-14 grid gap-5 md:grid-cols-2">
            {steps.map((step, index) => (
              <Reveal as="li" key={step.n} delay={index * 80}>
                <Tilt className={`h-full rounded-[2rem] p-8 ${step.tone}`}>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-ink font-display text-xl font-bold text-white">{step.n}</span>
                  <h3 className="mt-6 text-3xl font-bold">{step.title}</h3>
                  <p className="mt-3 max-w-sm text-base">{step.body}</p>
                </Tilt>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Live thing */}
        <section id="try" className="scroll-mt-4 bg-ink py-32 text-white">
          <div className="mx-auto w-[min(1100px,calc(100%-32px))]">
            <Reveal>
              <h2 className="max-w-2xl text-5xl font-extrabold leading-[0.95] md:text-6xl">Pick a skill. Watch the ranking move.</h2>
            </Reveal>
            <Reveal delay={100} className="mt-14 rounded-[2rem] bg-paper p-6 text-ink md:p-10">
              <MatchDemo />
            </Reveal>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mx-auto w-[min(1100px,calc(100%-32px))] scroll-mt-4 py-32">
          <Reveal>
            <h2 className="max-w-2xl text-5xl font-extrabold leading-[0.95] md:text-6xl">Three roles. Three separate doors.</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {roles.map((role, index) => (
              <Reveal key={role.title} delay={index * 100}>
                <Tilt className={`flex h-full flex-col rounded-[2rem] p-8 ${role.tone}`}>
                  <h3 className="text-3xl font-bold">{role.title}</h3>
                  <p className="mt-3 flex-1 text-base">{role.body}</p>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <Link href={role.login} className="btn-dark">{role.cta}</Link>
                    <Link href={role.join} className="text-sm font-semibold underline underline-offset-4">{role.title === "Institutes" ? "Register" : "Join"}</Link>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Promises */}
        <section id="promises" className="scroll-mt-4 bg-lime py-32">
          <div className="mx-auto w-[min(1100px,calc(100%-32px))]">
            <Reveal>
              <h2 className="max-w-2xl text-5xl font-extrabold leading-[0.95] md:text-6xl">Built so alumni feel safe saying yes.</h2>
            </Reveal>
            <dl className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {promises.map((promise, index) => (
                <Reveal key={promise.title} delay={index * 80}>
                  <dt className="font-display text-3xl font-bold">{promise.title}</dt>
                  <dd className="mt-2 max-w-md text-lg">{promise.body}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Close */}
        <section className="mx-auto w-[min(1100px,calc(100%-32px))] py-32 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[0.95] md:text-7xl">Bring your alumni <span className="inline-block animate-wiggle">together</span>.</h2>
            <p className="mx-auto mt-6 max-w-lg text-lg text-muted">Set up your institute in a few minutes, then invite students and alumni with a link.</p>
            <Link href="/register/institute" className="btn-primary mt-10 px-8 py-4 text-base">Register your institute</Link>
          </Reveal>
        </section>
      </main>

      <footer className="bg-ink px-4 py-10 text-white">
        <div className="mx-auto flex w-[min(1100px,100%)] flex-wrap items-center justify-between gap-4 text-sm">
          <Logo tone="light" />
          <span className="flex gap-4 text-white/70"><Link href="/terms" className="underline underline-offset-4">Terms</Link><Link href="/privacy" className="underline underline-offset-4">Privacy</Link></span>
          <span className="text-white/70">
            Already a member? <Link href="/login/student" className="font-semibold text-lime underline underline-offset-4">Sign in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
