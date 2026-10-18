import { InviteManager } from "@/components/admin/InviteManager";
import { requirePageUser } from "@/lib/auth/current";
import { listInvites } from "@/lib/services/invites";

export default async function AdminInvitesPage() {
  const admin = await requirePageUser("ADMIN");
  const invites = await listInvites(admin);
  return (
    <>
      <span className="eyebrow">invites</span>
      <h1 className="mt-2 text-4xl font-extrabold leading-none md:text-5xl">Invite students and alumni</h1>
      <div className="mt-8">
        <InviteManager invites={invites.map((invite) => ({ id: invite.id, email: invite.email, role: invite.role, status: invite.status, createdAt: invite.createdAt.toISOString() }))} />
      </div>
    </>
  );
}
