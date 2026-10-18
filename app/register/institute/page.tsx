import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterInstitutePage() {
  return (
    <AuthCard
      eyebrow="new institute"
      title="Register your institute"
      intro="You become the institute admin. Students sign up with an email from the domains you list; alumni join with your institute code and wait for your approval."
      footer={<>Already registered? <Link href="/login/admin" className="font-semibold text-ink underline">Sign in</Link></>}
    >
      <AuthForm
        endpoint="/api/auth/register-institute"
        submitLabel="Create institute"
        requireTerms
        fields={[
          { name: "instituteName", label: "Institute name", placeholder: "Northbridge Institute of Technology" },
          { name: "domains", label: "Student email domains", placeholder: "college.edu", help: "Separate several with commas." },
          { name: "name", label: "Your name", autoComplete: "name" },
          { name: "email", label: "Your work email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", help: "At least 8 characters with a letter and a number." },
        ]}
      />
    </AuthCard>
  );
}
