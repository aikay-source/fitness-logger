export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const sub = (await req.json()) as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return new NextResponse("Invalid subscription", { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      keys: JSON.stringify(sub.keys),
      userId: session.user.id,
    },
    update: {
      keys: JSON.stringify(sub.keys),
      userId: session.user.id,
    },
  });

  return new NextResponse(null, { status: 201 });
}
