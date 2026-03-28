import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, DollarSign, Users, Zap } from "lucide-react";
import DashboardClient from "./DashboardClient";
import ThemeToggle from "@/components/ThemeToggle";

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
  if (!session) redirect("/login");
  const coachId = session.user.id;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Streak: look back up to 90 days
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [lowClients, unpaidClients, monthSessions, recentSessions, streakSessions, sampleClients, totalClients] =
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
      prisma.client.findMany({
        where: { coachId, active: true },
        orderBy: { name: "asc" },
        take: 2,
        select: { name: true },
      }),
      prisma.client.count({
        where: { coachId, active: true },
      }),
    ]);

  const firstName = session.user.name?.split(" ")[0] ?? "Coach";
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
    <main id="main-content" className="mx-auto max-w-lg space-y-6 px-4 pt-8">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            {getGreeting()}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)] text-wrap-balance">
            {firstName}.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 2 && (() => {
            const milestone = [90, 60, 30, 14, 7].find((m) => streak >= m);
            const isMilestone = milestone && streak === milestone;
            return (
              <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                isMilestone
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-[var(--app-border)] bg-[var(--app-surface)]"
              }`}>
                <Zap size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--app-text)]">
                  {streak}d
                </span>
              </div>
            );
          })()}
          <ThemeToggle />
        </div>
      </div>

      {/* Getting started — shown only when coach has no clients */}
      {totalClients === 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Get started
          </h2>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-elevated)]">
                <Users size={16} className="text-[var(--app-tertiary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--app-text)]">
                  Add your clients to start tracking sessions
                </p>
                <p className="mt-0.5 text-xs text-[var(--app-muted)] text-pretty">
                  Add them one by one, or import a spreadsheet if you have an existing roster.
                </p>
              </div>
            </div>
            <Link
              href="/clients"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 active:scale-[0.98] transition-[background-color,transform]"
            >
              <Users size={14} />
              Add clients
            </Link>
          </div>
        </section>
      )}

      {/* Chat: log sessions or query history */}
      {totalClients > 0 && (
        <DashboardClient clientNames={sampleClients.map((c) => c.name.split(" ")[0])} />
      )}

      {/* Needs attention */}
      {(lowClients.length > 0 || unpaidClients.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Needs attention
          </h2>
          <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {lowClients.map((client) => {
              const critical = client.sessionsRemaining <= 1;
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-elevated)] transition-[background-color,transform] active:scale-[0.98] first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    critical ? "bg-red-500/10" : "bg-amber-500/10"
                  }`}>
                    <AlertTriangle
                      size={14}
                      className={critical ? "text-red-400" : "text-amber-400"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--app-text)]">
                      {client.name}
                    </p>
                    <p className={`text-xs ${critical ? "text-red-400/50" : "text-amber-400/50"}`}>
                      {critical ? "Last session in package" : "Running low"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${
                      critical ? "text-red-400" : "text-amber-400"
                    }`}>
                      {client.sessionsRemaining}
                    </span>
                    <span className={`font-mono text-[10px] mt-0.5 ${
                      critical ? "text-red-400/40" : "text-amber-400/40"
                    }`}>
                      left
                    </span>
                  </div>
                </Link>
              );
            })}
            {unpaidClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-elevated)] transition-[background-color,transform] active:scale-[0.98] first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <DollarSign size={14} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--app-text)]">
                    {client.name}
                  </p>
                  <p className="text-xs text-orange-400/50">
                    Unpaid session{client.unpaidSessions !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="font-mono text-lg font-semibold tabular-nums leading-none text-orange-400">
                    {client.unpaidSessions}
                  </span>
                  <span className="font-mono text-[10px] mt-0.5 text-orange-400/40">
                    owed
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* This month — hidden when no clients yet */}
      {totalClients > 0 && <section className="space-y-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          This month
        </h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-heading text-3xl font-semibold tabular-nums text-[var(--app-text)]">
                {monthSessions.length}
              </p>
              <p className="mt-0.5 text-sm text-[var(--app-tertiary)]">sessions logged</p>
            </div>
            {mostActive && (
              <div className="text-right">
                <p className="text-xs text-[var(--app-muted)]">most active</p>
                <p className="max-w-[140px] truncate text-sm font-medium text-[var(--app-text)]">
                  {mostActive.name}
                </p>
                <p className="font-mono text-xs tabular-nums text-[var(--app-muted)]">
                  {mostActive.count} session{mostActive.count !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
          <Link
            href="/reports"
            className="relative mt-3 inline-block font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] active:scale-[0.96] transition-[color,transform] before:absolute before:inset-[-8px] before:content-['']"
          >
            View full report →
          </Link>
        </div>
      </section>}

      {/* Recent activity */}
      {recentSessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Recent sessions
          </h2>
          <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-border)] font-mono text-[10px] font-semibold text-[var(--app-tertiary)]">
                  {s.client.name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                </div>
                <p className="flex-1 truncate text-sm text-[var(--app-text)]">{s.client.name}</p>
                <p className="font-mono text-xs text-[var(--app-muted)]">
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
    </main>
  );
}
