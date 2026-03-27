"use client";

import { useState, useEffect } from "react";
import { Download, ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { useCountUp } from "@/hooks/useCountUp";

type SessionRow = {
  id: string;
  date: string;
  clientName: string;
  notes: string | null;
};

type Stats = {
  totalSessions: number;
  uniqueClients: number;
  mostActive: { name: string; count: number } | null;
  lowClients: { name: string; sessionsRemaining: number }[];
};

type ReportData = {
  sessions: SessionRow[];
  stats: Stats;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsClient({
  initialYear,
  initialMonth,
}: {
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSummary(null);
    fetch(`/api/reports/monthly?year=${year}&month=${month}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) setData(await res.json());
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [year, month]);

  const animatedSessions = useCountUp(data?.stats.totalSessions ?? 0);
  const animatedClients = useCountUp(data?.stats.uniqueClients ?? 0);

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  async function generateSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/ai/monthly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const json = await res.json();
      setSummary(json.summary ?? null);
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleExport() {
    if (!data) return;
    const rows = data.sessions.map((s) => ({
      Date: new Date(s.date).toLocaleDateString("en-GB"),
      "Client Name": s.clientName,
      Notes: s.notes ?? "",
    }));
    exportToCSV(rows, `fitness-log-${year}-${String(month).padStart(2, "0")}.csv`);
  }

  const isCurrentOrFuture =
    year > initialYear ||
    (year === initialYear && month >= initialMonth);

  const statCardClass =
    "rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4";

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Header */}
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          Monthly
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)]">
          Reports
        </h1>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go to previous month"
          className="rounded-lg p-1.5 text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p className="font-semibold text-[var(--app-text)]" aria-live="polite" aria-atomic="true">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button
          onClick={() => navigate(1)}
          disabled={isCurrentOrFuture}
          aria-label="Go to next month"
          className="rounded-lg p-1.5 text-[var(--app-muted)] hover:text-[var(--app-tertiary)] disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-[var(--app-muted)]" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={statCardClass}>
              <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--app-text)]">
                {animatedSessions}
              </p>
              <p className="mt-0.5 text-xs text-[var(--app-tertiary)]">sessions logged</p>
            </div>
            <div className={statCardClass}>
              <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--app-text)]">
                {animatedClients}
              </p>
              <p className="mt-0.5 text-xs text-[var(--app-tertiary)]">unique clients</p>
            </div>
            {data.stats.mostActive && (
              <div className={`${statCardClass} col-span-2`}>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                  Most active
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--app-text)]">
                  {data.stats.mostActive.name}
                </p>
                <p className="text-xs text-[var(--app-muted)]">
                  {data.stats.mostActive.count} session
                  {data.stats.mostActive.count !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>

          {/* AI Summary */}
          {data.stats.totalSessions > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                  Month in words
                </h2>
                {!summary && (
                  <button
                    onClick={generateSummary}
                    disabled={summaryLoading}
                    className="flex items-center gap-1 font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] disabled:opacity-50 transition-colors"
                  >
                    {summaryLoading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    {summaryLoading ? "Writing…" : "Generate"}
                  </button>
                )}
              </div>
              {summary ? (
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <p className="text-sm leading-relaxed text-[var(--app-tertiary)]">{summary}</p>
                </div>
              ) : (
                !summaryLoading && (
                  <p className="text-xs text-[var(--app-muted)]">
                    Generate a short AI summary of your month.
                  </p>
                )
              )}
            </section>
          )}

          {/* Session breakdown */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                Sessions
              </h2>
              {data.sessions.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1 font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
                >
                  <Download size={11} />
                  Export CSV
                </button>
              )}
            </div>

            {data.sessions.length === 0 ? (
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center">
                <p className="text-sm text-[var(--app-tertiary)]">No sessions logged this month.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                {data.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--app-text)]">
                        {s.clientName}
                      </p>
                      {s.notes && (
                        <p className="mt-0.5 truncate text-xs text-[var(--app-muted)]">
                          {s.notes}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-mono text-xs text-[var(--app-muted)]">
                      {new Date(s.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Low package warning */}
          {data.stats.lowClients.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                Expiring packages
              </h2>
              <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                {data.stats.lowClients.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <p className="text-sm text-[var(--app-text)]">{c.name}</p>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        c.sessionsRemaining <= 1
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                    >
                      {c.sessionsRemaining} left
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
