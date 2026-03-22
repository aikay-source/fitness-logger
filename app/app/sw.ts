import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Fitness Logger", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: data.url ?? "/" },
    })
  );
});

// Notification click — open the app at the given URL
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        const url: string = event.notification.data?.url ?? "/";
        const existingClient = clientList.find((c) => c.url === url);
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(url);
      })
  );
});

serwist.addEventListeners();
