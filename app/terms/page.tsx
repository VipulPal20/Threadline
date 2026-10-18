import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms · Threadline" };

/** A plain-language starting point. Have a lawyer review it for your country and customers before launch. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="By creating an account you agree to these terms. They are short on purpose."
      sections={[
        {
          heading: "What Threadline is",
          body: ["Threadline is a private network run for one institute at a time. It helps students ask for guidance and helps alumni choose whom they help. Introductions happen only when an alumnus agrees."],
        },
        {
          heading: "Your account",
          body: [
            "Give accurate information and keep your password to yourself. You are responsible for what happens under your account.",
            "Your institute's admin can approve, suspend or remove accounts in that institute.",
          ],
        },
        {
          heading: "Be respectful",
          body: [
            "Treat everyone with courtesy. Do not harass, spam, pressure people for contact details, or share someone else's private information.",
            "Do not post anything unlawful, misleading or abusive, and do not try to get around the app's privacy protections.",
            "Do not ask for or share email addresses or phone numbers. Conversations happen inside the app.",
          ],
        },
        {
          heading: "Guidance is not a promise",
          body: ["Alumni give their time voluntarily. Advice and referrals are opinions, not guarantees of a job, admission or any other outcome. Threadline is not responsible for decisions you make based on a conversation."],
        },
        {
          heading: "Your content",
          body: ["You keep ownership of what you write and upload. You allow Threadline to store and show it to the people described in the Privacy Policy so the service can work."],
        },
        {
          heading: "Ending things",
          body: ["You can delete your account at any time in Settings. We or your institute may suspend accounts that break these terms."],
        },
        {
          heading: "Changes",
          body: ["If we change these terms in a way that matters, we will ask you to agree again."],
        },
      ]}
    />
  );
}
