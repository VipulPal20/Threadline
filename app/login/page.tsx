import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";

const options = [
  { href: "/login/admin", label: "Institute admin", hint: "Alumni office or placement cell" },
  { href: "/login/alumni", label: "Alumni", hint: "Help students from your institute" },
  { href: "/login/student", label: "Student", hint: "Ask for the help you need" },
];

export default function LoginChooserPage() {
  return (
    <AuthCard eyebrow="sign in" title="Who are you?" footer={<>New institute? <Link href="/register/institute" className="font-semibold text-ink underline">Register it</Link></>}>
      <div className="space-y-3">
        {options.map((option) => (
          <Link key={option.href} href={option.href} className="block rounded-xl border border-line px-4 py-3.5 transition hover:border-lime-dark hover:bg-lime-soft">
            <span className="block font-semibold">{option.label}</span>
            <span className="text-sm text-muted">{option.hint}</span>
          </Link>
        ))}
      </div>
    </AuthCard>
  );
}
