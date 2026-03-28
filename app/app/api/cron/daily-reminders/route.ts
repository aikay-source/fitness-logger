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
  // reminderTime stored as "HH:MM" in 24h UTC — filter at DB level using
  // the (reminderEnabled, reminderTime) index rather than loading all users
  const matching = await prisma.user.findMany({
    where: {
      reminderEnabled: true,
      reminderTime: { startsWith: `${currentHour}:` },
    },
    select: { id: true, name: true, reminderTime: true },
  });

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
