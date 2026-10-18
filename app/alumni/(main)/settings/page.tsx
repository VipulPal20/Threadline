import { AccountPanel } from "@/components/account/AccountPanel";
import { AlumniSettingsForm } from "@/components/profile/AlumniSettingsForm";
import { requirePageUser } from "@/lib/auth/current";
import { getAccountSettings } from "@/lib/services/account";
import { getAlumniSettings } from "@/lib/services/profiles";

export default async function AlumniSettingsPage() {
  const user = await requirePageUser("ALUMNI");
  const [settings, account] = await Promise.all([getAlumniSettings(user), getAccountSettings(user)]);
  return (
    <>
      <span className="eyebrow">alumni</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Settings</h1>
      <AlumniSettingsForm initial={settings} />
      <div className="mt-8"><AccountPanel initialEmailNotifications={account.emailNotifications} termsAcceptedAt={account.termsAcceptedAt} /></div>
    </>
  );
}
