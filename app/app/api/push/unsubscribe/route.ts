import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { endpoint } = (await req.json()) as { endpoint: string };

  await prisma.pushSubscription
    .deleteMany({
      where: { endpoint, userId: session.user.id },
    })
    .catch(() => null);

  return new NextResponse(null, { status: 204 });
}
