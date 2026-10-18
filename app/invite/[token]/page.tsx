import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { ApiError } from "@/lib/errors";
import { previewInvite } from "@/lib/services/invites";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  let preview: Awaited<ReturnType<typeof previewInvite>>;
  try {
    preview = await previewInvite((await params).token);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <AuthCard eyebrow="invite" title="This link doesn't work" intro="It may have expired or already been used. Ask your institute admin for a new invite.">
        <Link href="/login" className="btn-ghost w-full">Go to sign in</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={`${preview.role.toLowerCase()} invite`}
      title={`Join ${preview.instituteName}`}
      intro={`You were invited as ${preview.email}. Choose a password to finish.`}
    >
      <AuthForm
        endpoint="/api/auth/invite/accept"
        submitLabel="Create my account"
        requireTerms
        extra={{ token: (await params).token }}
        fields={[
          { name: "name", label: "Full name", defaultValue: preview.name ?? "", autoComplete: "name" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", help: "At least 8 characters with a letter and a number." },
        ]}
      />
    </AuthCard>
  );
}
