import Link from "next/link";
import { AskForm } from "@/components/asks/AskForm";
import { requirePageUser } from "@/lib/auth/current";
import { askQuota } from "@/lib/services/asks";

export default async function NewAskPage() {
  const student = await requirePageUser("STUDENT");
  const quota = await askQuota(student);
  return (
    <div className="mx-auto max-w-3xl">
      <span className="eyebrow">new ask</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">What do you need help with?</h1>
      {quota.remaining <= 0 ? (
        <div className="card space-y-3">
          <h2 className="text-xl font-bold">You&apos;ve used all {quota.limit} asks this month</h2>
          <p className="text-sm text-muted">Your allowance resets at the start of next month. Meanwhile you can follow up on your existing asks.</p>
          <Link href="/student/asks" className="btn-ghost">See my asks</Link>
        </div>
      ) : (
        <AskForm quota={quota} />
      )}
    </div>
  );
}
