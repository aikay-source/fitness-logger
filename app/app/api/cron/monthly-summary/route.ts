import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/send-push";

function verifyCron(req: Request) {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return new NextResponse("Unauthorized", { status: 401 });

  const now = new Date();
  // Run on the 1st — notify about the *previous* month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthName = prevMonth.toLocaleString("en-GB", { month: "long" });
  const year = prevMonth.getFullYear();

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
  });

  await Promise.allSettled(
    users.map((user) =>
      sendPushToUser(user.id, {
        title: `Your ${monthName} summary is ready`,
        body: "Tap to see your sessions and stats for last month.",
        url: `/reports?year=${year}&month=${prevMonth.getMonth() + 1}`,
      })
    )
  );

  return NextResponse.json({ notified: users.length });
}
