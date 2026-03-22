import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ClientDetailClient from "./ClientDetailClient";

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
        include: { packageEpisode: true },
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
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/clients"
          className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
        >
          <ChevronLeft size={13} />
          Clients
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#3d3d3c] font-mono text-sm font-semibold text-[#f2f1ed]">
              {client.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[#f2f1ed]">
                {client.name}
              </h1>
              {client.phone && (
                <p className="font-mono text-xs text-[#5e5e5c]">{client.phone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Package episodes track */}
      {client.packageEpisodes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Package history
          </h2>
          <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
            {client.packageEpisodes.map((ep) => {
              const used = client.sessions.filter(
                (s) => s.packageEpisodeId === ep.id
              ).length;
              const pct = ep.totalSessions > 0 ? Math.round((used / ep.totalSessions) * 100) : 0;
              return (
                <div key={ep.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#f2f1ed]">
                        {ep.totalSessions}-session package
                      </p>
                      <p className="font-mono text-xs text-[#5e5e5c]">
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
                          : "text-[#a3a29f]"
                      }`}
                    >
                      {ep.status === "completed" ? "Completed" : `${used}/${ep.totalSessions}`}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#3d3d3c]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ep.status === "completed" ? "bg-emerald-400" : "bg-[#f2f1ed]"
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
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Session history
          </h2>
          {client.sessions.length > 0 && (
            <p className="font-mono text-xs text-[#5e5e5c]">
              {client.sessions.length} total
            </p>
          )}
        </div>

        {monthGroups.length === 0 ? (
          <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-6 text-center">
            <p className="text-sm text-[#a3a29f]">No sessions logged yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {monthGroups.map((group) => (
              <details key={`${group.year}-${group.month}`} className="group" open={group === monthGroups[0]}>
                <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] px-4 py-3 hover:border-[#5e5e5c] transition-colors list-none">
                  <p className="text-sm font-semibold text-[#f2f1ed]">
                    {MONTH_NAMES[group.month]} {group.year}
                  </p>
                  <span className="font-mono text-xs text-[#5e5e5c]">
                    {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                  </span>
                </summary>

                <div className="mt-1 divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
                  {group.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-[#f2f1ed]">
                            {new Date(s.date).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.sessionNumber && s.packageSize && (
                              <span className="font-mono text-xs text-[#5e5e5c]">
                                {s.sessionNumber}/{s.packageSize}
                              </span>
                            )}
                            {!s.paid && (
                              <span className="font-mono text-xs text-orange-400">
                                unpaid
                              </span>
                            )}
                            {s.notes && (
                              <span className="max-w-[120px] truncate text-xs text-[#a3a29f]">
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
    </div>
  );
}
