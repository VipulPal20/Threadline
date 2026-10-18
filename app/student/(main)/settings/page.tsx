import { AccountPanel } from "@/components/account/AccountPanel";
import { requirePageUser } from "@/lib/auth/current";
import { getAccountSettings } from "@/lib/services/account";

export default async function StudentSettingsPage() {
  const user = await requirePageUser("STUDENT");
  const settings = await getAccountSettings(user);
  return (
    <>
      <span className="eyebrow">student</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Settings</h1>
      <AccountPanel initialEmailNotifications={settings.emailNotifications} termsAcceptedAt={settings.termsAcceptedAt} />
    </>
  );
}
