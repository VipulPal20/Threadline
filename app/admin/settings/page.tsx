import { SettingsForm } from "@/components/admin/SettingsForm";
import { requirePageUser } from "@/lib/auth/current";
import { getSettings } from "@/lib/services/admin";

export default async function AdminSettingsPage() {
  const admin = await requirePageUser("ADMIN");
  const settings = await getSettings(admin);
  return (
    <>
      <span className="eyebrow">settings</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Institute settings</h1>
      <SettingsForm initial={settings} />
    </>
  );
}
