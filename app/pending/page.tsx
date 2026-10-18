import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";

export default function PendingApprovalPage() {
  return (
    <AuthCard eyebrow="almost there" title="Waiting for approval" intro="Your institute admin needs to approve your account. Once they do, you can sign in with the email and password you just chose.">
      <Link href="/login/alumni" className="btn-ghost w-full">Back to sign in</Link>
    </AuthCard>
  );
}
