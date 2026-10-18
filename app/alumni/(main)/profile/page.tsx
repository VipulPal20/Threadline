import { AlumniProfileForm } from "@/components/profile/AlumniProfileForm";
import { plain } from "@/lib/client-api";
import { requirePageUser } from "@/lib/auth/current";
import { getAlumniProfile } from "@/lib/services/profiles";

export default async function AlumniProfilePage() {
  const user = await requirePageUser("ALUMNI");
  const view = await getAlumniProfile(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">alumni</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Your profile</h1>
      <AlumniProfileForm mode="page" initial={plain(view)} />
    </div>
  );
}
