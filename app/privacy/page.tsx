import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Threadline" };

const CONTACT = process.env.LEGAL_CONTACT_EMAIL ?? "your institute admin";

/** A plain-language starting point. Have a lawyer review it for your country and customers before launch. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Threadline helps students and alumni of an institute find each other for guidance. This page explains what we keep, who sees it and the choices you have."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Your account details: name, email, password (stored only as a one-way hash) and your role.",
            "What you add to your profile: education, work history, skills, location, and a résumé if you upload one. Alumni also set a private limit for how many students they can help.",
            "What you do in the app: asks you post, requests you send or answer, messages in conversations, ratings, and notifications.",
            "Basic technical records such as sign-in times and security logs.",
          ],
        },
        {
          heading: "Who can see what",
          body: [
            "Your email address and phone number are never shown to other users.",
            "Students and alumni in your institute see the profile details you add. Alumni never see a student's résumé until the student sends them a request.",
            "An alumnus's private help limit is never shown to anyone, including students. It is only used to rank people and to hide them when they are full.",
            "Messages are visible only to the two people in the conversation. Your institute's admins see counts, dates and statuses for tracking, never message text.",
            "People at other institutes can never see your data.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To rank alumni for a student's ask, send introductions, run conversations, and give your institute's admins numbers about how well the network works.",
            "If your institute turns on AI help, the text of an ask or a résumé may be sent to an AI service to draft a message or fill a form. Emails and phone numbers are removed first. AI features are optional and fall back to plain templates when off.",
            "We email you about activity that needs you, such as a new request. You can switch these emails off in Settings.",
            "We do not sell your data and do not show advertising.",
          ],
        },
        {
          heading: "How long we keep it",
          body: ["We keep your data while your account exists. If you delete your account, your personal details, profile, résumé and messages are removed or anonymised as described below. Anonymous counts that help your institute measure results may remain."],
        },
        {
          heading: "Your choices",
          body: [
            "Download your data: Settings has a button that gives you a copy of everything we hold about you.",
            "Delete your account: Settings lets you delete your account. This signs you out, ends open conversations, removes your profile and résumé, and replaces your name and email with placeholders.",
            "Turn off emails: Settings has a switch for activity emails.",
            "To correct something, edit your profile. For anything else, contact us.",
          ],
        },
        {
          heading: "Security",
          body: ["Passwords are hashed, sessions use secure cookies, and each institute's data is kept separate. No system is perfectly secure, so please use a strong password and tell us if you see something wrong."],
        },
        {
          heading: "Contact",
          body: [`Questions or requests about your data: ${CONTACT}.`],
        },
      ]}
    />
  );
}
