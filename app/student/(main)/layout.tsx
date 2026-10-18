import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current";

/** Everything except onboarding itself needs a finished profile. */
export default async function StudentMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("STUDENT");
  if (!user.onboardingComplete) redirect("/student/onboarding");
  return <>{children}</>;
}
