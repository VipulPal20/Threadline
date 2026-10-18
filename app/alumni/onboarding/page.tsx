import { redirect } from "next/navigation";
import { AlumniProfileForm } from "@/components/profile/AlumniProfileForm";
import { plain } from "@/lib/client-api";
import { requirePageUser } from "@/lib/auth/current";
import { getAlumniProfile } from "@/lib/services/profiles";

export default async function AlumniOnboardingPage() {
  const user = await requirePageUser("ALUMNI");
  if (user.onboardingComplete) redirect("/alumni/dashboard");
  const view = await getAlumniProfile(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">welcome</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Tell students how you can help</h1>
      <AlumniProfileForm mode="wizard" initial={plain(view)} />
    </div>
  );
}
