"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { NotificationView } from "@/lib/dto/notification";
import { LocalTime } from "./ui/LocalTime";

const POLL_MS = 20_000;

/** Bell with an unread count, refreshed every 20 seconds while the tab is visible. */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ unread: number; notifications: NotificationView[] }>("/api/notifications");
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // keep what we have; the next poll will retry
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api("/api/notifications", { method: "POST", json: {} }).catch(() => undefined);
      setUnread(0);
    }
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative rounded-full bg-[#edf0e9] px-3 py-2 text-sm">
        🔔
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-auto rounded-2xl border border-line bg-white p-2 shadow-lift">
          {items.length === 0 && <p className="p-4 text-sm text-muted">Nothing yet.</p>}
          {items.map((item) => {
            const inner = (
              <>
                <p className={`text-sm ${item.read ? "text-muted" : "font-semibold"}`}>{item.text}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted"><LocalTime iso={item.createdAt} /></p>
              </>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl p-3 hover:bg-lime-soft">{inner}</Link>
            ) : (
              <div key={item.id} className="rounded-xl p-3">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
