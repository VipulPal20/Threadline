import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { parseRoleSlug } from "@/lib/auth/types";

export default async function RegisterMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const slug = parseRoleSlug((await params).role);
  if (!slug || slug === "admin") notFound();

  const student = slug === "student";
  return (
    <AuthCard
      eyebrow={student ? "student sign up" : "alumni sign up"}
      title={student ? "Create your student account" : "Create your alumni account"}
      intro={
        student
          ? "Use your institute email. Next you will add your details and résumé."
          : "Your institute admin approves alumni accounts before you can sign in."
      }
      footer={<>Already have an account? <Link href={`/login/${slug}`} className="font-semibold text-ink underline">Sign in</Link></>}
    >
      <AuthForm
        endpoint="/api/auth/register"
        submitLabel="Create account"
        requireTerms
        extra={{ role: slug }}
        fields={[
          { name: "code", label: "Institute code", placeholder: "ABCD-2345", defaultValue: (await searchParams).code, help: "Ask your institute for this code." },
          { name: "name", label: "Full name", autoComplete: "name" },
          { name: "email", label: student ? "Institute email" : "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", help: "At least 8 characters with a letter and a number." },
        ]}
      />
    </AuthCard>
  );
}
