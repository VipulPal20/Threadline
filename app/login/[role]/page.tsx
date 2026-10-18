import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/auth/current";
import { homePathFor, parseRoleSlug } from "@/lib/auth/types";

const COPY = {
  admin: { title: "Institute admin sign in", eyebrow: "institute admin" },
  alumni: { title: "Alumni sign in", eyebrow: "alumni" },
  student: { title: "Student sign in", eyebrow: "student" },
} as const;

export default async function RoleLoginPage({ params }: { params: Promise<{ role: string }> }) {
  const slug = parseRoleSlug((await params).role);
  if (!slug) notFound();

  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  const footer =
    slug === "admin" ? (
      <>New institute? <Link href="/register/institute" className="font-semibold text-ink underline">Register it</Link></>
    ) : (
      <>No account yet? <Link href={`/register/${slug}`} className="font-semibold text-ink underline">Create one</Link> · <Link href="/login" className="underline">Not a {slug}?</Link></>
    );

  return (
    <AuthCard eyebrow={COPY[slug].eyebrow} title={COPY[slug].title} footer={footer}>
      <AuthForm
        endpoint="/api/auth/login"
        submitLabel="Sign in"
        extra={{ role: slug }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthCard>
  );
}
