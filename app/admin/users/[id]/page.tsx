import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/ui/LocalTime";
import { requirePageUser } from "@/lib/auth/current";
import type { AskCategory } from "@/lib/domain/constants";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import { ApiError } from "@/lib/errors";
import { getAdminUser } from "@/lib/services/admin";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageUser("ADMIN");
  let data: Awaited<ReturnType<typeof getAdminUser>>;
  try {
    data = await getAdminUser(admin, (await params).id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { user, student, alumnus } = data;
  const profile = student ?? alumnus!;
  const skills = profile.skills;

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted underline">← Members</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <aside className="card h-fit space-y-3">
          <span className="eyebrow">{user.role.toLowerCase()}</span>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="break-all text-sm text-muted">{user.email}</p>
          <p><span className="badge">{user.status.replace("_", " ").toLowerCase()}</span></p>
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted">Joined: </dt><dd className="inline"><LocalTime iso={user.createdAt.toISOString()} mode="date" /></dd></div>
            <div><dt className="inline text-muted">Last sign-in: </dt><dd className="inline">{user.lastLoginAt ? <LocalTime iso={user.lastLoginAt.toISOString()} /> : "never"}</dd></div>
            <div><dt className="inline text-muted">Profile complete: </dt><dd className="inline">{data.completeness}%</dd></div>
            <div><dt className="inline text-muted">{user.role === "STUDENT" ? "Asks posted: " : "Requests received: "}</dt><dd className="inline">{data.stats.asks}</dd></div>
            <div><dt className="inline text-muted">{user.role === "STUDENT" ? "Resolved: " : "Accepted: "}</dt><dd className="inline">{data.stats.resolved}</dd></div>
          </dl>
          {user.role === "ALUMNI" && <p className="rounded-xl bg-[#edf0e9] p-3 text-xs text-muted">An alumnus&apos;s capacity settings are private to them and are not shown to admins.</p>}
        </aside>

        <section className="card space-y-5">
          <div>
            <h2 className="text-xl font-bold">Profile</h2>
            {profile.headline && <p className="mt-1 text-sm">{profile.headline}</p>}
            {profile.bio && <p className="mt-2 whitespace-pre-line text-sm text-muted">{profile.bio}</p>}
          </div>
          {alumnus && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Role</dt><dd>{[alumnus.currentTitle, alumnus.currentCompany].filter(Boolean).join(" at ") || "—"}</dd></div>
              <div><dt className="text-muted">Industry</dt><dd>{alumnus.industry ?? "—"}</dd></div>
              <div><dt className="text-muted">Experience</dt><dd>{alumnus.yearsExperience != null ? `${alumnus.yearsExperience} years` : "—"}</dd></div>
              <div><dt className="text-muted">Class of</dt><dd>{alumnus.graduationYear ?? "—"} · {alumnus.department ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Can help with</dt><dd>{alumnus.helpTypes.map((type) => CATEGORY_LABELS[type as AskCategory] ?? type).join(", ") || "—"}</dd></div>
            </dl>
          )}
          {student && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Studying</dt><dd>{[student.degree, student.department].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt className="text-muted">Graduates</dt><dd>{student.graduationYear ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Aiming for</dt><dd>{student.targetRoles.join(", ") || "—"}</dd></div>
            </dl>
          )}
          <div>
            <h3 className="mb-2 font-semibold">Skills</h3>
            {skills.length === 0 ? <p className="text-sm text-muted">None added yet.</p> : (
              <ul className="flex flex-wrap gap-1.5">{skills.map((skill) => <li key={skill.name} className="rounded-full bg-lime-soft px-2.5 py-1 text-xs">{skill.name} · {skill.level.toLowerCase()}</li>)}</ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
