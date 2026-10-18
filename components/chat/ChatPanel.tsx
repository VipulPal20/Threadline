"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { ChatMessage } from "@/lib/services/conversations";
import { inputClass } from "../ui/fields";
import { LocalTime } from "../ui/LocalTime";

const POLL_MS = 4000;

type AiTask = "suggest" | "improve" | "summarise";

interface Thread {
  status: string;
  canSend: boolean;
  messages: ChatMessage[];
}


export function ChatPanel({ conversationId, initial, otherName }: { conversationId: string; initial: Thread; otherName: string }) {
  const [thread, setThread] = useState<Thread>(initial);
  const [text, setText] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [aiBusy, setAiBusy] = useState<AiTask | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const refresh = useCallback(async () => {
    try {
      setThread(await api<Thread>(`/api/conversations/${conversationId}/messages`));
    } catch {
      // keep what is on screen; the next poll retries
    }
  }, [conversationId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [thread.messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/conversations/${conversationId}/messages`, { method: "POST", json: { body, aiAssisted: aiUsed } });
      setText("");
      setAiUsed(false);
      setAiNote(null);
      stick.current = true;
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  async function runAi(task: AiTask) {
    setAiBusy(task);
    setError(null);
    setAiNote(null);
    try {
      const result = await api<{ text: string; usedFallback: boolean }>(`/api/conversations/${conversationId}/ai`, { method: "POST", json: { task, text } });
      if (task === "summarise") {
        setSummary(result.text);
      } else {
        // Suggestions land in the box for editing. Nothing is sent until the person presses Send.
        setText(result.text);
        setAiUsed(true);
        setAiNote(result.usedFallback ? "Template suggestion. Edit it, then send." : "AI suggestion. Check and edit it before sending.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI help is unavailable.");
    } finally {
      setAiBusy(null);
    }
  }

  const lastMine = [...thread.messages].reverse().find((message) => message.mine);

  return (
    <div className="card flex h-[70vh] min-h-[480px] flex-col p-0">
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
        className="flex-1 space-y-3 overflow-y-auto p-5"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${otherName}`}
      >
        {thread.messages.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hello.</p>}
        {thread.messages.map((message) => (
          <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${message.mine ? "bg-ink text-white" : "bg-[#f3f6ef]"}`}>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={`mt-1 font-mono text-[10px] ${message.mine ? "text-white/60" : "text-muted"}`}>
                <LocalTime iso={message.createdAt} />
                {message.aiAssisted ? " · AI-assisted" : ""}
                {message.mine && lastMine?.id === message.id && message.readAt ? " · Seen" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {thread.canSend ? (
        <div className="space-y-3 border-t border-line p-4">
          {summary && (
            <div className="rounded-xl bg-lime-soft p-3 text-sm">
              <div className="mb-1 flex justify-between"><strong>Summary</strong><button type="button" onClick={() => setSummary(null)} aria-label="Dismiss summary" className="text-muted">✕</button></div>
              <p className="whitespace-pre-line">{summary}</p>
            </div>
          )}
          <label htmlFor="chat-input" className="sr-only">Your message</label>
          <textarea
            id="chat-input"
            rows={3}
            value={text}
            maxLength={2000}
            placeholder={`Message ${otherName}…`}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            className={inputClass}
          />
          {aiNote && <p role="status" className="text-xs text-lime-dark">{aiNote}</p>}
          {error && <p role="alert" className="rounded-xl bg-sun-soft px-3.5 py-2.5 text-sm text-sun-dark">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">✨ AI help</span>
              <button type="button" onClick={() => runAi("suggest")} disabled={aiBusy !== null} className="btn-ghost px-3 py-1.5 text-xs">{aiBusy === "suggest" ? "Thinking…" : "Suggest a reply"}</button>
              <button type="button" onClick={() => runAi("improve")} disabled={aiBusy !== null || text.trim().length < 5} className="btn-ghost px-3 py-1.5 text-xs">{aiBusy === "improve" ? "Polishing…" : "Improve my message"}</button>
              <button type="button" onClick={() => runAi("summarise")} disabled={aiBusy !== null} className="btn-ghost px-3 py-1.5 text-xs">{aiBusy === "summarise" ? "Summarising…" : "Summarise"}</button>
            </div>
            <button type="button" onClick={send} disabled={sending || !text.trim()} className="btn-dark">{sending ? "Sending…" : "Send"}</button>
          </div>
        </div>
      ) : (
        <p className="border-t border-line p-4 text-center text-sm text-muted">This conversation has ended. You can still read it.</p>
      )}
    </div>
  );
}
