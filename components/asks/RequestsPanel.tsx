import type { StudentRequestView } from "@/lib/services/requests";
import { LocalTime } from "../ui/LocalTime";
import { WithdrawButton } from "./WithdrawButton";

const STATE_LABEL: Record<string, string> = {
  PENDING: "Waiting for a reply",
  ACCEPTED: "Accepted",
  DECLINED: "Can't help right now",
  EXPIRED: "No reply in time",
  WITHDRAWN: "Withdrawn",
  CLOSED: "Closed",
};


/** The student's requests for one ask, newest first. Contacts appear only on accepted ones. */
export function RequestsPanel({ requests }: { requests: StudentRequestView[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-2xl font-bold">Your requests</h2>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">{request.alumnus.name}</h3>
                <p className="text-sm text-muted">{[request.alumnus.currentTitle, request.alumnus.currentCompany].filter(Boolean).join(" at ")}</p>
              </div>
              <span className="badge">{STATE_LABEL[request.state] ?? request.state}</span>
            </div>
            <p className="text-xs text-muted">
              Sent <LocalTime iso={request.createdAt} mode="date" />
              {request.state === "PENDING" && <> · expires <LocalTime iso={request.expiresAt} mode="date" /></>}
              {request.respondedAt && <> · answered <LocalTime iso={request.respondedAt} mode="date" /></>}
            </p>
            {request.state === "PENDING" && <WithdrawButton requestId={request.id} />}
            {request.state === "DECLINED" && <p className="text-sm text-muted">Pick another alumnus below. They are not shown again for this ask.</p>}
            {request.state === "ACCEPTED" && (
              <div className="rounded-xl bg-lime-soft p-4 text-sm">
                <p className="font-semibold">{request.alumnus.name} said yes. You can chat with them here.</p>
                {request.conversationId && <a href={`/student/conversations/${request.conversationId}`} className="btn-primary mt-3">Open the conversation ↗</a>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
