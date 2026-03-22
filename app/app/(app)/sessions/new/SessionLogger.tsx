"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, List, Check, AlertCircle, Loader2, X } from "lucide-react";
import { logSession } from "@/app/actions/sessions";
import { matchNames, type ClientStub, type MatchResult } from "@/lib/fuzzy-match";
import { enqueueSession } from "@/lib/offline-queue";

type Client = ClientStub & { sessionsRemaining: number };

type Tab = "ai" | "manual";

type ConfirmState = {
  matched: MatchResult[];
  selectedIds: string[];
  date: Date;
  notes: string;
};

function sessionBadgeClass(remaining: number) {
  if (remaining <= 2) return "text-red-400";
  if (remaining <= 5) return "text-amber-400";
  return "text-emerald-400";
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
  const [tab, setTab] = useState<Tab>("ai");

  // AI tab state
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);

  // Manual tab state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  // Shared confirmation state
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [committing, setCommitting] = useState(false);

  // ── AI Quick Log ──────────────────────────────────────────────────────────

  async function handleAIParse() {
    if (!aiText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/ai/parse-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });
      const data = (await res.json()) as { clients: string[]; error?: string };

      if (data.error) {
        toast.error("AI parsing failed — check the server console for details, or use manual log.");
        return;
      }
      if (data.clients.length === 0) {
        toast.error("No names found in that text. Try: \"trained John and Sarah today\"");
        return;
      }

      const matched = matchNames(data.clients, clients);
      const matchedIds = matched
        .filter((m): m is { matched: true; client: ClientStub } => m.matched)
        .map((m) => m.client.id);

      setConfirm({
        matched,
        selectedIds: matchedIds,
        date: new Date(),
        notes: aiText,
      });
    } catch {
      toast.error("Network error. Try manual log.");
    } finally {
      setParsing(false);
    }
  }

  // ── Manual Log ────────────────────────────────────────────────────────────

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
      toast.success(
        toastMessage(result.sessionCount, result.completedPackages, result.lowSessions, result.unpaidAdded),
        { duration: result.completedPackages.length > 0 ? 6000 : 4000 }
      );
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setCommitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-2.5 text-sm text-[#f2f1ed] placeholder:text-[#5e5e5c] focus:border-[#a3a29f] focus:outline-none transition-colors";

  // ── Confirmation screen ───────────────────────────────────────────────────

  if (confirm) {
    const matchedClients = confirm.matched.filter(
      (m): m is { matched: true; client: ClientStub } => m.matched
    );
    const unmatched = confirm.matched.filter(
      (m): m is { matched: false; input: string } => !m.matched
    );

    return (
      <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f2f1ed]">
            Confirm session
          </h1>
          <p className="mt-1 text-sm text-[#a3a29f]">
            {new Date(confirm.date).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        {/* Matched clients */}
        <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
          {matchedClients.map(({ client }) => {
            const full = clients.find((c) => c.id === client.id);
            const remaining = full ? full.sessionsRemaining - 1 : "?";
            return (
              <div
                key={client.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Check size={14} className="text-emerald-400 shrink-0" />
                <p className="flex-1 text-sm text-[#f2f1ed]">{client.name}</p>
                <span
                  className={`font-mono text-xs ${sessionBadgeClass(Number(remaining))}`}
                >
                  {remaining} left after
                </span>
              </div>
            );
          })}
        </div>

        {/* Unmatched names */}
        {unmatched.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-amber-400">
              Could not match
            </p>
            {unmatched.map((u) => (
              <p key={u.input} className="text-sm text-amber-300">
                "{u.input}" — not found in your roster
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setConfirm(null)}
            className="flex items-center gap-1.5 rounded-lg border border-[#3d3d3c] px-4 py-2.5 text-sm text-[#a3a29f] hover:border-[#5e5e5c] transition-colors"
          >
            <X size={14} />
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={committing || matchedClients.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
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
      </div>
    );
  }

  // ── Main log screen ───────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-[#f2f1ed]">
        Log sessions
      </h1>

      {/* Tab toggle */}
      <div className="flex rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] p-1">
        {(["ai", "manual"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[#f2f1ed] text-[#141413]"
                : "text-[#5e5e5c] hover:text-[#a3a29f]"
            }`}
          >
            {t === "ai" ? (
              <>
                <Sparkles size={13} />
                Quick log
              </>
            ) : (
              <>
                <List size={13} />
                Manual
              </>
            )}
          </button>
        ))}
      </div>

      {/* AI tab */}
      {tab === "ai" && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-[#a3a29f]">
              Type who you trained today — naturally.
            </p>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAIParse();
              }}
              placeholder="e.g. trained Marcus, Yemi and John this morning"
              rows={3}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-right font-mono text-xs text-[#5e5e5c]">
              ⌘↵ to parse
            </p>
          </div>
          <button
            onClick={handleAIParse}
            disabled={parsing || !aiText.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
          >
            {parsing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {parsing ? "Parsing…" : "Parse names"}
          </button>

          <p className="text-center text-xs text-[#5e5e5c]">
            Can&apos;t parse?{" "}
            <button
              onClick={() => setTab("manual")}
              className="text-[#a3a29f] underline underline-offset-2"
            >
              Switch to manual
            </button>
          </p>
        </div>
      )}

      {/* Manual tab */}
      {tab === "manual" && (
        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
              Date
            </label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Client checkboxes */}
          <div>
            <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
              Clients ({selectedIds.size} selected)
            </label>
            {clients.length === 0 ? (
              <p className="text-sm text-[#5e5e5c]">No clients yet.</p>
            ) : (
              <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
                {clients.map((client) => {
                  const selected = selectedIds.has(client.id);
                  return (
                    <button
                      key={client.id}
                      onClick={() => toggleClient(client.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                        selected ? "bg-[#262625]" : "hover:bg-[#1a1a19]"
                      }`}
                    >
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected
                            ? "border-[#f2f1ed] bg-[#f2f1ed]"
                            : "border-[#3d3d3c]"
                        }`}
                      >
                        {selected && (
                          <Check size={11} className="text-[#141413]" />
                        )}
                      </div>
                      <p className="flex-1 text-sm text-[#f2f1ed]">
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
            <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
              Notes{" "}
              <span className="normal-case text-[#5e5e5c]">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on legs today"
              className={inputClass}
            />
          </div>

          <button
            onClick={handleManualContinue}
            disabled={selectedIds.size === 0}
            className="w-full rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-40 transition-colors"
          >
            Review →
          </button>
        </div>
      )}

      {/* Offline warning banner */}
      <OfflineBanner />
    </div>
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
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertCircle size={14} className="text-amber-400 shrink-0" />
      <p className="text-xs text-amber-300">
        You&apos;re offline — sessions will be saved and synced when reconnected.
      </p>
    </div>
  );
}
