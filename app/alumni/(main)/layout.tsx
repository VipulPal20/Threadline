import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current";

/** Everything except onboarding itself needs a finished profile. */
export default async function AlumniMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ALUMNI");
  if (!user.onboardingComplete) redirect("/alumni/onboarding");
  return <>{children}</>;
}
