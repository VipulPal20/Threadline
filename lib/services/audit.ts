import { db } from "../db";

/** Appends to the event stream that admin metrics are computed from. Never put message text in payload. */
export async function recordEvent(input: {
  instituteId: string;
  actorId?: string | null;
  kind: string;
  entity?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.auditEvent.create({
    data: {
      instituteId: input.instituteId,
      actorId: input.actorId ?? null,
      kind: input.kind,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      payload: JSON.stringify(input.payload ?? {}),
    },
  });
}
