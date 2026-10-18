"use client";

import { useCallback } from "react";

/**
 * Shows fresh server data after a change (approve, send, accept, resolve...).
 * A plain reload is used on purpose: with Next.js 15 the soft router.refresh() sometimes left the old screen showing
 * after an await, while a reload always renders what the server actually has. These actions are infrequent, so the cost is small.
 */
export function useRefresh() {
  return useCallback(() => window.location.reload(), []);
}
