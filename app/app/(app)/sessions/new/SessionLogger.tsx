"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, AlertCircle, Loader2, X } from "lucide-react";
import { logSession } from "@/app/actions/sessions";
import { type ClientStub, type MatchResult } from "@/lib/fuzzy-match";
import { EASE_OUT } from "@/lib/motion.config";
import { enqueueSession } from "@/lib/offline-queue";
import confetti from "canvas-confetti";

type Client = ClientStub & { sessionsRemaining: number };

type ConfirmState = {
  matched: MatchResult[];
  selectedIds: string[];
  date: Date;
  notes: string;
};

function sessionBadgeClass(remaining: number) {
  if (remaining <= 2) return "text-red-400";
  if (remaining <= 5) return "text-amber-400";
  return "text-[var(--app-muted)]";
}

function toastMessage(count: number, completed: string[], low: string[], unpaid: string[]): string {
  const base = count === 1 ? "1 session logged." : `${count} sessions logged.`;
  if (unpaid.length === 1) return `${base} ${unpaid[0]} has no sessions left — logged as unpaid.`;
  if (unpaid.length > 1) return `${base} ${unpaid.length} clients logged as unpaid (zero balance).`;
  if (completed.length === 1) return `${base} ${completed[0]} just finished their package — time to renew!`;
  if (completed.length > 1) return `${base} ${completed.length} clients finished their packages!`;
  if (low.length === 1) return `${base} Heads up — ${low[0]} is running low.`;
  if (low.length > 1) return `${base} ${low.length} clients are running low.`;
  return `${base} Nice work!`;
}

export default function SessionLogger({ clients }: { clients: Client[] }) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  // Confirmation state
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [committing, setCommitting] = useState(false);

  function toggleClient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleManualContinue() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one client.");
      return;
    }
    const matched: MatchResult[] = clients
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ matched: true as const, client: c }));

    setConfirm({
      matched,
      selectedIds: Array.from(selectedIds),
      date: new Date(manualDate),
      notes,
    });
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!confirm) return;
    setCommitting(true);

    const ids = confirm.selectedIds;
    const date = confirm.date;

    // Offline support
    if (!navigator.onLine) {
      await enqueueSession({ clientIds: ids, date: date.toISOString(), notes: confirm.notes || undefined });
      toast.success("Saved offline — will sync when reconnected.");
      router.push("/dashboard");
      return;
    }

    try {
      const result = await logSession(ids, date, confirm.notes || undefined);
      if (!result.success) {
        toast.error(result.error ?? "Failed to log sessions.");
        return;
      }
      // Celebrate!
      confetti({
        particleCount: result.sessionCount > 2 ? 80 : 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: (() => {
          const s = getComputedStyle(document.documentElement);
          return [s.getPropertyValue("--app-text").trim(), s.getPropertyValue("--app-tertiary").trim(), s.getPropertyValue("--app-border").trim()];
        })(),
        disableForReducedMotion: true,
      });
      toast.success(
        toastMessage(result.sessionCount, result.completedPackages, result.lowSessions, result.unpaidAdded),
        { duration: result.completedPackages.length > 0 ? 6000 : 4000 }
      );
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong. Try again or pick clients manually.");
    } finally {
      setCommitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-[var(--app-tertiary)] focus:outline-none transition-colors";

  // ── Confirmation screen ───────────────────────────────────────────────────

  if (confirm) {
    const matchedClients = confirm.matched.filter(
      (m): m is { matched: true; client: ClientStub } => m.matched
    );
    return (
      <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)] text-wrap-balance">
            Confirm session
          </h1>
          <p className="mt-1 text-sm text-[var(--app-tertiary)]">
            {new Date(confirm.date).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        {/* Matched clients */}
        <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          {matchedClients.map(({ client }, i) => {
            const full = clients.find((c) => c.id === client.id);
            const remaining = full ? full.sessionsRemaining - 1 : "?";
            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04, ease: EASE_OUT }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Check size={14} className="text-emerald-400 shrink-0" />
                <p className="flex-1 text-sm text-[var(--app-text)]">{client.name}</p>
                <span
                  className={`font-mono text-xs ${sessionBadgeClass(Number(remaining))}`}
                >
                  → {remaining} left
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setConfirm(null)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-tertiary)] hover:border-[var(--app-muted)] transition-colors"
          >
            <X size={14} />
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={committing || matchedClients.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {committing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {committing
              ? "Logging…"
              : `Log ${matchedClients.length} session${matchedClients.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </main>
    );
  }

  // ── Main log screen ───────────────────────────────────────────────────────

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)] text-wrap-balance">
          Log sessions
        </h1>
        <p className="mt-1 text-sm text-[var(--app-tertiary)] text-pretty">
          Pick clients and date. For quick logging, use the chat on your dashboard.
        </p>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="session-date" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          Date
        </label>
        <input
          id="session-date"
          type="date"
          value={manualDate}
          onChange={(e) => setManualDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Client checkboxes */}
      <div>
        <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          Clients ({selectedIds.size} selected)
        </label>
        {clients.length === 0 ? (
          <p className="text-sm text-[var(--app-muted)]">No clients yet.</p>
        ) : (
          <div className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {clients.length > 8 && (
              <div className="px-4 py-2.5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--app-muted)] focus:outline-none"
                />
              </div>
            )}
            {clients
              .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
              .map((client) => {
              const selected = selectedIds.has(client.id);
              return (
                <button
                  key={client.id}
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggleClient(client.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    selected ? "bg-[var(--app-elevated)]" : "hover:bg-[var(--app-elevated)]"
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded border transition-[background-color,border-color,transform] duration-150 ${
                      selected
                        ? "border-[var(--app-text)] bg-[var(--app-text)] scale-110"
                        : "border-[var(--app-border)] scale-100"
                    }`}
                  >
                    {selected && (
                      <Check size={11} className="text-[var(--app-text-inv)]" />
                    )}
                  </div>
                  <p className="flex-1 text-sm text-[var(--app-text)]">
                    {client.name}
                  </p>
                  <span
                    className={`font-mono text-xs ${sessionBadgeClass(client.sessionsRemaining)}`}
                  >
                    {client.sessionsRemaining}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="session-notes" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          Notes{" "}
          <span className="normal-case text-[var(--app-muted)]">(optional)</span>
        </label>
        <input
          id="session-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Focus on legs today"
          maxLength={200}
          className={inputClass}
        />
      </div>

      <button
        onClick={handleManualContinue}
        disabled={selectedIds.size === 0}
        className="w-full rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 disabled:opacity-40 transition-colors"
      >
        Review →
      </button>

      {/* Offline warning banner */}
      <OfflineBanner />
    </main>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertCircle size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
      <p className="text-xs text-amber-300">
        You&apos;re offline — sessions will be saved and synced when reconnected.
      </p>
    </div>
  );
}
