import webpush from "web-push";
import { prisma } from "@/lib/prisma";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Send a push notification to all subscriptions for a user.
 * Silently removes stale (410 Gone) subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const keys = JSON.parse(sub.keys) as { p256dh: string; auth: string };
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — remove it
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => null);
        }
      }
    })
  );
}
