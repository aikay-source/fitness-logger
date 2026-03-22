"use client";

import { useOfflineSync } from "@/hooks/useOfflineSync";

export default function OfflineSyncProvider() {
  useOfflineSync();
  return null;
}
