import { AppShell } from "@/components/AppShell";
import { requirePageUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ADMIN");
  return (
    <AppShell
      user={user}
      nav={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/asks", label: "Asks" },
        { href: "/admin/users", label: "Members" },
        { href: "/admin/invites", label: "Invites" },
        { href: "/admin/settings", label: "Settings" },
      ]}
    >
      {children}
    </AppShell>
  );
}
