import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ClientDetailClient from "./ClientDetailClient";
import DeleteClientButton from "./DeleteClientButton";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const coachId = session!.user.id;

  const client = await prisma.client.findFirst({
    where: { id, coachId },
    include: {
      sessions: {
        orderBy: { date: "desc" },
      },
      packageEpisodes: {
        orderBy: { startDate: "asc" },
      },
    },
  });

  if (!client) notFound();

  // Group sessions by year+month
  type MonthGroup = {
    year: number;
    month: number;
    sessions: typeof client.sessions;
  };

  const monthMap = new Map<string, MonthGroup>();
  for (const s of client.sessions) {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { year: d.getFullYear(), month: d.getMonth(), sessions: [] });
    }
    monthMap.get(key)!.sessions.push(s);
  }

  const monthGroups = [...monthMap.values()].sort(
    (a, b) => b.year - a.year || b.month - a.month
  );

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/clients"
          className="relative mb-4 inline-flex items-center gap-1 font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] active:scale-[0.96] transition-[color,transform] before:absolute before:inset-[-8px] before:content-['']"
        >
          <ChevronLeft size={13} />
          Clients
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--app-border)] font-mono text-sm font-semibold text-[var(--app-text)]">
              {client.name
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-[var(--app-text)] truncate">
                {client.name}
              </h1>
              {client.phone && (
                <p className="font-mono text-xs text-[var(--app-muted)]">{client.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Package episodes track */}
      {client.packageEpisodes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Package history
          </h2>
          <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {client.packageEpisodes.map((ep) => {
              const used = client.sessions.filter(
                (s) => s.packageEpisodeId === ep.id
              ).length;
              const pct = ep.totalSessions > 0 ? Math.round((used / ep.totalSessions) * 100) : 0;
              return (
                <div key={ep.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--app-text)]">
                        {ep.totalSessions}-session package
                      </p>
                      <p className="font-mono text-xs text-[var(--app-muted)]">
                        Started{" "}
                        {new Date(ep.startDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {ep.endDate && (
                          <>
                            {" "}·{" "}
                            {new Date(ep.endDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        ep.status === "completed"
                          ? "text-emerald-400"
                          : "text-[var(--app-tertiary)]"
                      }`}
                    >
                      {ep.status === "completed" ? "Completed" : `${used}/${ep.totalSessions}`}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ep.status === "completed" ? "bg-emerald-400" : "bg-[var(--app-text)]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Package card — editable */}
      <ClientDetailClient
        client={{
          id: client.id,
          name: client.name,
          totalSessionsPurchased: client.totalSessionsPurchased,
          sessionsRemaining: client.sessionsRemaining,
          unpaidSessions: client.unpaidSessions,
        }}
      />

      {/* Session history — grouped by month */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Session history
          </h2>
          {client.sessions.length > 0 && (
            <p className="font-mono text-xs text-[var(--app-muted)]">
              {client.sessions.length} session{client.sessions.length !== 1 ? "s" : ""} across {monthGroups.length} month{monthGroups.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {monthGroups.length === 0 ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center space-y-2">
            <p className="text-sm text-[var(--app-tertiary)]">No sessions logged yet.</p>
            <Link
              href="/dashboard"
              className="inline-block font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
            >
              Log a session →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {monthGroups.map((group) => (
              <details key={`${group.year}-${group.month}`} className="group" open={group === monthGroups[0]}>
                <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 hover:border-[var(--app-muted)] transition-colors list-none">
                  <p className="text-sm font-semibold text-[var(--app-text)]">
                    {MONTH_NAMES[group.month]} {group.year}
                  </p>
                  <span className="font-mono text-xs text-[var(--app-muted)]">
                    {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                  </span>
                </summary>

                <div className="mt-1 divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                  {group.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-[var(--app-text)]">
                            {new Date(s.date).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.sessionNumber && s.packageSize && (
                              <span className="font-mono text-xs text-[var(--app-muted)]">
                                {s.sessionNumber}/{s.packageSize}
                              </span>
                            )}
                            {!s.paid && (
                              <span className="font-mono text-xs text-orange-400">
                                unpaid
                              </span>
                            )}
                            {s.notes && (
                              <span className="max-w-[120px] truncate text-xs text-[var(--app-tertiary)]">
                                {s.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone — last on page */}
      <DeleteClientButton clientId={client.id} clientName={client.name} />
    </main>
  );
}
