import Link from "next/link";
import type { ConversationSummary } from "@/lib/services/conversations";

export function ConversationList({ conversations, basePath }: { conversations: ConversationSummary[]; basePath: string }) {
  if (conversations.length === 0) {
    return <div className="card text-sm text-muted">No conversations yet. They appear here as soon as a request is accepted.</div>;
  }
  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <Link key={conversation.id} href={`${basePath}/${conversation.id}`} className="link-card flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{conversation.with}</h3>
            <p className="truncate text-sm text-muted">{conversation.ask.title}</p>
            {conversation.lastMessage && (
              <p className="mt-1 truncate text-xs text-muted">{conversation.lastMessage.mine ? "You: " : ""}{conversation.lastMessage.snippet}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {conversation.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-sun px-1.5 text-xs font-bold text-white">{conversation.unread}</span>}
            <span className="badge">{conversation.status === "ACTIVE" ? "active" : conversation.ask.status === "RESOLVED" ? "resolved" : "ended"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
