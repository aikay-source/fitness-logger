import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/send-push";

function verifyCron(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return new NextResponse("Unauthorized", { status: 401 });

  const nowUTC = new Date();
  const currentHour = nowUTC.getUTCHours().toString().padStart(2, "0");
  // reminderTime stored as "HH:MM" in 24h UTC
  const matchPattern = `${currentHour}:%`;

  // SQLite LIKE query — find coaches whose reminder matches the current hour
  const users = await prisma.user.findMany({
    where: {
      reminderEnabled: true,
      reminderTime: { not: null },
    },
    select: { id: true, name: true, reminderTime: true },
  });

  const matching = users.filter(
    (u) => u.reminderTime?.startsWith(currentHour + ":")
  );

  await Promise.allSettled(
    matching.map((user) =>
      sendPushToUser(user.id, {
        title: "Log today's sessions",
        body: `Hey ${user.name?.split(" ")[0] ?? "Coach"} — don't forget to log your sessions!`,
        url: "/sessions/new",
      })
    )
  );

  return NextResponse.json({ sent: matching.length });
}
