import Link from "next/link";
import { UsersTable } from "@/components/admin/UsersTable";
import { requirePageUser } from "@/lib/auth/current";
import { ROLES, USER_STATUSES, type Role, type UserStatus } from "@/lib/domain/constants";
import { listInstituteUsers } from "@/lib/services/users";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ status?: string; role?: string; q?: string }> }) {
  const admin = await requirePageUser("ADMIN");
  const query = await searchParams;
  const status = USER_STATUSES.find((value) => value === query.status) as UserStatus | undefined;
  const role = ROLES.find((value) => value === query.role && value !== "ADMIN") as Role | undefined;
  const q = query.q?.trim().slice(0, 100) || undefined;
  const users = await listInstituteUsers(admin, { status, role, q });

  const tabs = [
    { label: "All", href: "/admin/users" },
    { label: "Pending approval", href: "/admin/users?status=PENDING_APPROVAL" },
    { label: "Students", href: "/admin/users?role=STUDENT" },
    { label: "Alumni", href: "/admin/users?role=ALUMNI" },
    { label: "Suspended", href: "/admin/users?status=SUSPENDED" },
  ];

  return (
    <>
      <span className="eyebrow">members</span>
      <h1 className="mt-2 text-4xl font-extrabold leading-none md:text-5xl">Students and alumni</h1>
      <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        {role && <input type="hidden" name="role" value={role} />}
        <label className="sr-only" htmlFor="member-search">Search members</label>
        <input id="member-search" name="q" defaultValue={q} placeholder="Search name or email" className="w-72 max-w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-lime-dark focus:ring-4 focus:ring-lime-soft" />
        <button type="submit" className="btn-dark px-4 py-2.5">Search</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-lime-soft">
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <UsersTable users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))} />
      </div>
    </>
  );
}
