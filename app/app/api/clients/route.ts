import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, totalSessionsPurchased, sessionsRemaining } =
    await req.json();

  if (!name?.trim()) {
    return new NextResponse("Name is required", { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      totalSessionsPurchased: Math.max(0, Number(totalSessionsPurchased) || 0),
      sessionsRemaining: Math.max(0, Number(sessionsRemaining) || 0),
      coachId: session.user.id,
    },
  });

  return NextResponse.json(client);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const clients = await prisma.client.findMany({
    where: { coachId: session.user.id, active: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}
