import { AppShell } from "@/components/AppShell";
import { requirePageUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AlumniLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ALUMNI");
  return <AppShell user={user} nav={[{ href: "/alumni/dashboard", label: "Dashboard" }, { href: "/alumni/requests", label: "Requests" }, { href: "/alumni/conversations", label: "Conversations" }, { href: "/alumni/profile", label: "Profile" }, { href: "/alumni/settings", label: "Settings" }]}>{children}</AppShell>;
}
