import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ImportClient = {
  name: string;
  totalSessionsPurchased?: number;
  sessionsRemaining?: number;
  unpaidSessions?: number;
  phone?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { clients } = (await req.json()) as { clients: ImportClient[] };

  if (!Array.isArray(clients) || clients.length === 0) {
    return new NextResponse("No clients provided", { status: 400 });
  }

  const coachId = session.user.id;

  const result = await prisma.client.createMany({
    data: clients
      .filter((c) => c.name?.trim())
      .map((c) => {
        const sessionsRemaining = Math.max(0, Number(c.sessionsRemaining) || 0);
        return {
          name: c.name.trim(),
          phone: c.phone?.trim() || null,
          totalSessionsPurchased: Math.max(0, Number(c.totalSessionsPurchased) || 0),
          sessionsRemaining,
          // Unpaid only valid when sessionsRemaining is 0
          unpaidSessions: sessionsRemaining === 0 ? Math.max(0, Number(c.unpaidSessions) || 0) : 0,
          coachId,
        };
      }),
  });

  return NextResponse.json({ imported: result.count });
}
