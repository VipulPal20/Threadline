import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-[min(460px,calc(100%-32px))] flex-col justify-center py-12">
      <div className="card animate-pop space-y-4">
        <LogoMark size={48} className="animate-wiggle" />
        <span className="eyebrow">404</span>
        <h1 className="text-4xl font-extrabold leading-none">This thread leads nowhere</h1>
        <p className="text-sm text-muted">The link may be old, or it may belong to someone else&apos;s account. Check the address, or head back to your dashboard.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="btn-dark">Go to sign in</Link>
          <Link href="/" className="btn-ghost">Home</Link>
        </div>
      </div>
    </main>
  );
}
