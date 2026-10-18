import type { SessionUser } from "@/lib/auth/types";
import { AppHeader } from "./AppHeader";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";

export interface NavItem {
  href: string;
  label: string;
}

const ROLE_LABEL = { ADMIN: "Institute admin", ALUMNI: "Alumni", STUDENT: "Student" } as const;

export function AppShell({ user, nav, children }: { user: SessionUser; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader nav={nav}>
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="mt-0.5 inline-block rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{ROLE_LABEL[user.role]}</div>
        </div>
        {user.role !== "ADMIN" && <NotificationBell />}
        <LogoutButton />
      </AppHeader>
      <main className="mx-auto w-[min(1180px,calc(100%-32px))] py-10">{children}</main>
      <footer className="mx-auto flex w-[min(1180px,calc(100%-32px))] items-center justify-between border-t border-line py-8 text-sm text-muted">
        <Logo size={24} />
        <span className="flex gap-4"><a href="/terms" className="underline">Terms</a><a href="/privacy" className="underline">Privacy</a></span>
      </footer>
    </div>
  );
}
