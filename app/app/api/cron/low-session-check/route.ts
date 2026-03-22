import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/send-push";

function verifyCron(req: Request) {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return new NextResponse("Unauthorized", { status: 401 });

  // Find all coaches with clients at ≤2 sessions remaining (and > 0)
  const lowClients = await prisma.client.findMany({
    where: { sessionsRemaining: { lte: 2, gt: 0 }, active: true },
    select: { name: true, sessionsRemaining: true, coachId: true },
  });

  // Group by coach
  const byCoach = new Map<string, typeof lowClients>();
  for (const client of lowClients) {
    const list = byCoach.get(client.coachId) ?? [];
    list.push(client);
    byCoach.set(client.coachId, list);
  }

  await Promise.allSettled(
    Array.from(byCoach.entries()).map(([coachId, clients]) => {
      const names = clients.map((c) => c.name);
      const body =
        names.length === 1
          ? `${names[0]} only has ${clients[0].sessionsRemaining} session${clients[0].sessionsRemaining === 1 ? "" : "s"} left.`
          : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are running low.`;

      return sendPushToUser(coachId, {
        title: "Packages running low",
        body,
        url: "/clients",
      });
    })
  );

  return NextResponse.json({ coachesNotified: byCoach.size });
}
