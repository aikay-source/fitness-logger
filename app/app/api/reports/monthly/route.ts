import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return new NextResponse("Invalid year or month", { status: 400 });
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const sessions = await prisma.session.findMany({
    where: {
      coachId: session.user.id,
      date: { gte: start, lt: end },
    },
    include: { client: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  // Summary stats
  const uniqueClients = new Set(sessions.map((s) => s.clientId));
  const clientCounts = new Map<string, { name: string; count: number }>();
  for (const s of sessions) {
    const entry = clientCounts.get(s.clientId) ?? { name: s.client.name, count: 0 };
    entry.count++;
    clientCounts.set(s.clientId, entry);
  }

  const mostActive = [...clientCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Low-package clients (at end of month)
  const lowClients = await prisma.client.findMany({
    where: {
      coachId: session.user.id,
      active: true,
      sessionsRemaining: { lte: 2, gt: 0 },
    },
    select: { name: true, sessionsRemaining: true },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      clientName: s.client.name,
      notes: s.notes,
    })),
    stats: {
      totalSessions: sessions.length,
      uniqueClients: uniqueClients.size,
      mostActive,
      lowClients,
    },
  });
}
