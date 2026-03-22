import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle, PlusCircle, DollarSign } from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function calcStreak(sessionDates: Date[]): number {
  if (sessionDates.length === 0) return 0;

  const logged = new Set(sessionDates.map(toDateKey));
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);

  // If nothing logged today, start checking from yesterday
  if (!logged.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (logged.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const coachId = session!.user.id;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Streak: look back up to 90 days
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [lowClients, unpaidClients, monthSessions, recentSessions, streakSessions] =
    await Promise.all([
      prisma.client.findMany({
        where: { coachId, sessionsRemaining: { lte: 2, gt: 0 }, active: true },
        orderBy: { sessionsRemaining: "asc" },
      }),
      prisma.client.findMany({
        where: { coachId, unpaidSessions: { gt: 0 }, active: true },
        orderBy: { unpaidSessions: "desc" },
        select: { id: true, name: true, unpaidSessions: true },
      }),
      prisma.session.findMany({
        where: { coachId, date: { gte: startOfMonth } },
        select: { clientId: true, client: { select: { name: true } } },
      }),
      prisma.session.findMany({
        where: { coachId },
        orderBy: { date: "desc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      prisma.session.findMany({
        where: { coachId, date: { gte: ninetyDaysAgo } },
        select: { date: true },
        orderBy: { date: "desc" },
      }),
    ]);

  const firstName = session!.user.name?.split(" ")[0] ?? "Coach";
  const streak = calcStreak(streakSessions.map((s) => s.date));

  // Most active client this month
  const clientCounts = new Map<string, { name: string; count: number }>();
  for (const s of monthSessions) {
    const entry = clientCounts.get(s.clientId) ?? { name: s.client.name, count: 0 };
    entry.count++;
    clientCounts.set(s.clientId, entry);
  }
  const mostActive = [...clientCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pt-8">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            {getGreeting()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#f2f1ed]">
            {firstName}.
          </h1>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-1.5">
            <span className="text-base">🔥</span>
            <span className="font-mono text-xs font-semibold text-[#f2f1ed]">
              {streak} days
            </span>
          </div>
        )}
      </div>

      {/* Quick log CTA */}
      <Link
        href="/sessions/new"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white transition-colors"
      >
        <PlusCircle size={16} />
        Log today&apos;s sessions
      </Link>

      {/* Low session alerts */}
      {lowClients.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Heads up
          </h2>
          <div className="space-y-2">
            {lowClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center gap-3 rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4 transition-colors hover:border-[#5e5e5c]"
              >
                <AlertTriangle
                  size={16}
                  className={
                    client.sessionsRemaining <= 1
                      ? "text-red-400"
                      : "text-amber-400"
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#f2f1ed]">
                    {client.name}
                  </p>
                  <p className="text-xs text-[#a3a29f]">
                    {client.sessionsRemaining === 1
                      ? "1 session left"
                      : `${client.sessionsRemaining} sessions left`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Unpaid sessions */}
      {unpaidClients.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Unpaid
          </h2>
          <div className="space-y-2">
            {unpaidClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 transition-colors hover:border-purple-500/50"
              >
                <DollarSign size={16} className="text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#f2f1ed]">
                    {client.name}
                  </p>
                  <p className="text-xs text-purple-300">
                    {client.unpaidSessions} unpaid session{client.unpaidSessions !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* This month */}
      <section className="space-y-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
          This month
        </h2>
        <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-3xl font-semibold text-[#f2f1ed]">
                {monthSessions.length}
              </p>
              <p className="mt-0.5 text-sm text-[#a3a29f]">sessions logged</p>
            </div>
            {mostActive && (
              <div className="text-right">
                <p className="text-xs text-[#5e5e5c]">most active</p>
                <p className="text-sm font-medium text-[#f2f1ed]">
                  {mostActive.name}
                </p>
                <p className="font-mono text-xs text-[#5e5e5c]">
                  {mostActive.count} session{mostActive.count !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
          <Link
            href="/reports"
            className="mt-3 block font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
          >
            View full report →
          </Link>
        </div>
      </section>

      {/* Recent activity */}
      {recentSessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Recent
          </h2>
          <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <p className="text-sm text-[#f2f1ed]">{s.client.name}</p>
                <p className="font-mono text-xs text-[#5e5e5c]">
                  {new Date(s.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
