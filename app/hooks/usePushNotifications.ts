"use client";

import { useState, useEffect } from "react";

export type PushState = "unsupported" | "default" | "granted" | "denied";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!("serviceWorker" in navigator)) return false;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PushState);
      if (permission !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    setState("default");
  }

  return { state, loading, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}
