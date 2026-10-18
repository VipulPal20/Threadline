import { redirect } from "next/navigation";
import { StudentProfileForm } from "@/components/profile/StudentProfileForm";
import { plain } from "@/lib/client-api";
import { requirePageUser } from "@/lib/auth/current";
import { getStudentProfile } from "@/lib/services/profiles";

export default async function StudentOnboardingPage() {
  const user = await requirePageUser("STUDENT");
  if (user.onboardingComplete) redirect("/student/dashboard");
  const view = await getStudentProfile(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">welcome</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Let&apos;s set up your profile</h1>
      <StudentProfileForm mode="wizard" initial={plain(view)} />
    </div>
  );
}
