import { AppShell } from "@/components/AppShell";
import { requirePageUser } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("STUDENT");
  return <AppShell user={user} nav={[{ href: "/student/dashboard", label: "Dashboard" }, { href: "/student/asks", label: "My asks" }, { href: "/student/conversations", label: "Conversations" }, { href: "/student/profile", label: "Profile" }, { href: "/student/settings", label: "Settings" }]}>{children}</AppShell>;
}
