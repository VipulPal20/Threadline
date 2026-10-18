import { db } from "../db";
import { recordEvent } from "./audit";
import { notify } from "./notifications";

/** Marks pending requests past their expiry as EXPIRED and tells both people. Run lazily before reads and ranking. */
export async function expireRequests(instituteId: string, now = new Date()): Promise<number> {
  const due = await db.introRequest.findMany({
    where: { state: "PENDING", expiresAt: { lte: now }, ask: { instituteId } },
    include: { ask: { select: { id: true, title: true } } },
  });
  for (const request of due) {
    await db.introRequest.update({ where: { id: request.id }, data: { state: "EXPIRED", closedAt: now } });
    const payload = { askId: request.askId, requestId: request.id, askTitle: request.ask.title };
    await notify(request.studentId, "request_expired", payload);
    await notify(request.alumniId, "request_expired", payload);
    await recordEvent({ instituteId, actorId: null, kind: "request.expired", entity: "request", entityId: request.id });
  }
  return due.length;
}
