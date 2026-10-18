import { db } from "../db";
import type { SessionUser } from "../auth/types";
import { toNotificationView } from "../dto/notification";
import { emailNotification } from "../email/notify";

export type NotificationKind =
  | "request_received"
  | "request_accepted"
  | "request_declined"
  | "request_expired"
  | "request_withdrawn"
  | "conversation_ended"
  | "ask_resolved"
  | "message_received"
  | "account_approved";

export async function notify(userId: string, kind: NotificationKind, payload: Record<string, unknown> = {}): Promise<void> {
  await db.notification.create({ data: { userId, kind, payload: JSON.stringify(payload) } });
  // Mail is slow and can fail, so it runs beside the request. Tests wait for it so they can check what went out.
  const mail = emailNotification(userId, kind, payload);
  if (process.env.NODE_ENV === "test") await mail;
}

export async function listNotifications(user: SessionUser, limit = 20) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { unread, notifications: rows.map((row) => toNotificationView(row, user.role)) };
}

/** Marks the given notifications (or all of this user's) as read. Only ever touches the caller's own rows. */
export async function markNotificationsRead(user: SessionUser, ids?: string[]): Promise<void> {
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}
