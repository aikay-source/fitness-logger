"use client";

import { useEffect } from "react";
import { getPendingSessions, removeSession } from "@/lib/offline-queue";
import { logSession } from "@/app/actions/sessions";
import { toast } from "sonner";

export function useOfflineSync() {
  useEffect(() => {
    async function sync() {
      const pending = await getPendingSessions();
      if (pending.length === 0) return;

      let synced = 0;
      for (const item of pending) {
        try {
          const result = await logSession(
            item.clientIds,
            new Date(item.date),
            item.notes
          );
          if (result.success) {
            await removeSession(item.id);
            synced++;
          }
        } catch {
          // Leave in queue for next attempt
        }
      }

      if (synced > 0) {
        toast.success(`Synced ${synced} offline session${synced !== 1 ? "s" : ""}.`);
      }
    }

    window.addEventListener("online", sync);
    // Also attempt on mount in case we're already back online
    if (navigator.onLine) sync();

    return () => window.removeEventListener("online", sync);
  }, []);
}
