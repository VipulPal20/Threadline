import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { ApiError } from "@/lib/errors";
import { previewReset } from "@/lib/services/password-reset";

export const dynamic = "force-dynamic";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  let preview: Awaited<ReturnType<typeof previewReset>>;
  try {
    preview = await previewReset((await params).token);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <AuthCard eyebrow="password reset" title="This link doesn't work" intro="It may have expired or already been used. Ask your institute admin for a new reset link.">
        <Link href="/login" className="btn-ghost w-full">Go to sign in</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard eyebrow="password reset" title="Choose a new password" intro={`Hi ${preview.name.split(" ")[0]}, pick a new password. You'll be signed out everywhere and asked to sign in again.`}>
      <AuthForm
        endpoint="/api/auth/reset"
        submitLabel="Set new password"
        extra={{ token: (await params).token }}
        fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", help: "At least 8 characters with a letter and a number." }]}
      />
    </AuthCard>
  );
}
