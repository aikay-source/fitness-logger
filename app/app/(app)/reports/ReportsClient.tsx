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
    "rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4";

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Header */}
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
          Monthly
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[#f2f1ed]">
          Reports
        </h1>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-semibold text-[#f2f1ed]">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button
          onClick={() => navigate(1)}
          disabled={isCurrentOrFuture}
          className="rounded-lg p-1.5 text-[#5e5e5c] hover:text-[#a3a29f] disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-[#5e5e5c]" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={statCardClass}>
              <p className="font-mono text-3xl font-semibold tabular-nums text-[#f2f1ed]">
                {animatedSessions}
              </p>
              <p className="mt-0.5 text-xs text-[#a3a29f]">sessions logged</p>
            </div>
            <div className={statCardClass}>
              <p className="font-mono text-3xl font-semibold tabular-nums text-[#f2f1ed]">
                {animatedClients}
              </p>
              <p className="mt-0.5 text-xs text-[#a3a29f]">unique clients</p>
            </div>
            {data.stats.mostActive && (
              <div className={`${statCardClass} col-span-2`}>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                  Most active
                </p>
                <p className="mt-1 text-sm font-medium text-[#f2f1ed]">
                  {data.stats.mostActive.name}
                </p>
                <p className="text-xs text-[#5e5e5c]">
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
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                  Month in words
                </h2>
                {!summary && (
                  <button
                    onClick={generateSummary}
                    disabled={summaryLoading}
                    className="flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] disabled:opacity-50 transition-colors"
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
                <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4">
                  <p className="text-sm leading-relaxed text-[#a3a29f]">{summary}</p>
                </div>
              ) : (
                !summaryLoading && (
                  <p className="text-xs text-[#5e5e5c]">
                    Generate a short AI summary of your month.
                  </p>
                )
              )}
            </section>
          )}

          {/* Session breakdown */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                Sessions
              </h2>
              {data.sessions.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
                >
                  <Download size={11} />
                  Export CSV
                </button>
              )}
            </div>

            {data.sessions.length === 0 ? (
              <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-6 text-center">
                <p className="text-sm text-[#a3a29f]">No sessions logged this month.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
                {data.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#f2f1ed]">
                        {s.clientName}
                      </p>
                      {s.notes && (
                        <p className="mt-0.5 truncate text-xs text-[#5e5e5c]">
                          {s.notes}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-mono text-xs text-[#5e5e5c]">
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
              <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                Expiring packages
              </h2>
              <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
                {data.stats.lowClients.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <p className="text-sm text-[#f2f1ed]">{c.name}</p>
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
    </div>
  );
}
