import { db } from "../db";
import { toNotificationView } from "../dto/notification";
import type { Role } from "../domain/constants";
import { emails } from "./templates";
import { sendEmail } from "./send";

/** The notifications worth an email. Everything else stays in the in-app bell only. */
const EMAILED: Record<string, { subject: string; heading: string; label: string }> = {
  request_received: { subject: "A student asked for your help", heading: "A student needs you", label: "Read the request" },
  request_accepted: { subject: "Your request was accepted", heading: "Good news: an alumnus said yes", label: "Open the conversation" },
  request_declined: { subject: "An alumnus can't help this time", heading: "Not this time", label: "Pick someone else" },
  message_received: { subject: "You have a new message", heading: "New message", label: "Open the conversation" },
  ask_resolved: { subject: "A student marked their ask resolved", heading: "Thank you for helping", label: "See the conversation" },
  account_approved: { subject: "Your Threadline account was approved", heading: "You're in", label: "Sign in" },
};

export function isEmailedKind(kind: string): boolean {
  return kind in EMAILED;
}

/** Emails the recipient about a notification, unless they have switched emails off or are not an active member. Never throws. */
export async function emailNotification(userId: string, kind: string, payload: Record<string, unknown>): Promise<void> {
  const template = EMAILED[kind];
  if (!template) return;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, role: true, status: true, emailNotifications: true } });
    if (!user || user.status !== "ACTIVE" || !user.emailNotifications) return;
    const view = toNotificationView({ id: "", kind, payload: JSON.stringify(payload), readAt: null, createdAt: new Date() }, user.role as Role);
    const loginPath = user.role === "ALUMNI" ? "/login/alumni" : user.role === "STUDENT" ? "/login/student" : "/login/admin";
    await sendEmail(emails.notification(user, { subject: template.subject, heading: template.heading, body: view.text, href: view.href ?? loginPath, label: template.label }));
  } catch (error) {
    console.error("[email] notification failed", kind, error instanceof Error ? error.message : error);
  }
}
