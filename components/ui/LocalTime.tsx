"use client";

import { useEffect, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value: number) => String(value).padStart(2, "0");

/** Locale-free text used for the server render and the first client render, so they always match. */
function stable(date: Date, mode: "datetime" | "date"): string {
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return mode === "date" ? `${day} ${date.getUTCFullYear()}` : `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function local(date: Date, mode: "datetime" | "date"): string {
  return mode === "date"
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * A timestamp in the viewer's own locale and timezone. The server cannot know either, so it renders a
 * fixed UTC form; right after mounting in the browser the text switches to the local one.
 */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "date" }) {
  const date = new Date(iso);
  const [text, setText] = useState(() => stable(date, mode));
  useEffect(() => setText(local(new Date(iso), mode)), [iso, mode]);
  return <time dateTime={iso}>{text}</time>;
}
