import type { Role } from "../domain/constants";

interface NotificationRow {
  id: string;
  kind: string;
  payload: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationView {
  id: string;
  kind: string;
  text: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/** Turns a stored notification into the sentence and link its recipient sees. */
export function toNotificationView(row: NotificationRow, role: Role): NotificationView {
  let payload: { askId?: string; requestId?: string; askTitle?: string; conversationId?: string } = {};
  try {
    payload = JSON.parse(row.payload) as typeof payload;
  } catch {
    // keep defaults
  }
  const title = payload.askTitle ? `“${payload.askTitle}”` : "your ask";
  const askHref = payload.askId ? `/student/asks/${payload.askId}` : null;
  const requestHref = payload.requestId ? `/alumni/requests/${payload.requestId}` : null;
  const chatHref = payload.conversationId ? `/${role === "ALUMNI" ? "alumni" : "student"}/conversations/${payload.conversationId}` : null;

  const byKind: Record<string, { text: string; href: string | null }> = {
    request_received: { text: `A student asked for your help with ${title}.`, href: requestHref },
    request_accepted: { text: `An alumnus accepted your request for ${title}. You can chat now.`, href: chatHref ?? askHref },
    request_declined: { text: `An alumnus can't help with ${title} right now.`, href: askHref },
    request_expired: { text: role === "ALUMNI" ? `A request for ${title} expired.` : `A request for ${title} expired without an answer.`, href: role === "ALUMNI" ? requestHref : askHref },
    request_withdrawn: { text: role === "ALUMNI" ? `A request for ${title} was withdrawn.` : `You withdrew a request for ${title}.`, href: role === "ALUMNI" ? requestHref : askHref },
    ask_resolved: { text: `${title} was marked resolved. Thank you for helping.`, href: chatHref ?? requestHref },
    conversation_ended: { text: `The conversation about ${title} was ended.`, href: chatHref },
    message_received: { text: "You have a new message.", href: chatHref },
    account_approved: { text: "Your account was approved.", href: null },
  };
  const entry = byKind[row.kind] ?? { text: "You have a new notification.", href: null };
  return { id: row.id, kind: row.kind, text: entry.text, href: entry.href, read: Boolean(row.readAt), createdAt: row.createdAt.toISOString() };
}
