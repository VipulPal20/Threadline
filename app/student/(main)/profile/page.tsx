import { StudentProfileForm } from "@/components/profile/StudentProfileForm";
import { plain } from "@/lib/client-api";
import { requirePageUser } from "@/lib/auth/current";
import { getStudentProfile } from "@/lib/services/profiles";

export default async function StudentProfilePage() {
  const user = await requirePageUser("STUDENT");
  const view = await getStudentProfile(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">student</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Your profile</h1>
      <StudentProfileForm mode="page" initial={plain(view)} />
    </div>
  );
}
