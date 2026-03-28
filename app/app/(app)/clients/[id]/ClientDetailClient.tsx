"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, DollarSign } from "lucide-react";
import PackageRing from "@/components/PackageRing";
type Client = {
  id: string;
  name: string;
  totalSessionsPurchased: number;
  sessionsRemaining: number;
  unpaidSessions: number;
};

export default function ClientDetailClient({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);
  const [purchased, setPurchased] = useState(client.totalSessionsPurchased);
  const [remaining, setRemaining] = useState(client.sessionsRemaining);
  const [unpaid, setUnpaid] = useState(client.unpaidSessions);

  const percentUsed =
    purchased > 0
      ? Math.round(((purchased - remaining) / purchased) * 100)
      : 0;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalSessionsPurchased: purchased,
          sessionsRemaining: remaining,
          unpaidSessions: remaining === 0 ? unpaid : 0,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Package updated.");
      setEditing(false);
    } catch {
      toast.error("Couldn't save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function markSettled() {
    setSettling(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unpaidSessions: 0 }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${unpaid} unpaid session${unpaid !== 1 ? "s" : ""} marked as settled.`);
      setUnpaid(0);
    } catch {
      toast.error("Couldn't save changes. Try again.");
    } finally {
      setSettling(false);
    }
  }

  function cancel() {
    setPurchased(client.totalSessionsPurchased);
    setRemaining(client.sessionsRemaining);
    setEditing(false);
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm text-[var(--app-text)] focus:border-[var(--app-tertiary)] focus:outline-none transition-colors";

  return (
    <>
      {/* Unpaid sessions card */}
      {unpaid > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Unpaid sessions
          </h2>
          <div className="rounded-xl border border-[var(--app-border)] border-l-2 border-l-orange-500 bg-[var(--app-surface)] p-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign size={16} className="text-orange-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--app-text)]">
                    {unpaid} session{unpaid !== 1 ? "s" : ""} owed
                  </p>
                  <p className="text-xs text-orange-400/60">
                    Trained without remaining balance
                  </p>
                </div>
              </div>
              <button
                onClick={markSettled}
                disabled={settling}
                aria-busy={settling}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-elevated)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--app-tertiary)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)] disabled:opacity-50 transition-colors"
              >
                {settling ? "…" : "Mark settled"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--app-muted)]">
              Settling clears the balance — use this after the client pays for their owed sessions.
            </p>
          </div>
        </section>
      )}

      {/* Package card */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Package
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="relative flex items-center gap-1 font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors before:absolute before:inset-[-6px] before:content-['']"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className="relative flex items-center gap-1 font-mono text-xs text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors before:absolute before:inset-[-6px] before:content-['']"
              >
                <X size={11} />
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="relative flex items-center gap-1 font-mono text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 before:absolute before:inset-[-6px] before:content-['']"
              >
                <Check size={11} />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-4">
          {!editing ? (
            <>
              <div className="flex items-center gap-4">
                <PackageRing remaining={remaining} total={purchased} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--app-text)]">
                    {remaining} of {purchased} remaining
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--app-muted)]">
                    {percentUsed}% used
                  </p>
                </div>
              </div>

              <div
                role="progressbar"
                aria-valuenow={percentUsed}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Package usage: ${percentUsed}% used`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--app-text)] transition-all"
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pkg-sessions-bought" className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                    Sessions bought
                  </label>
                  <input
                    id="pkg-sessions-bought"
                    type="number"
                    min="0"
                    max="9999"
                    value={purchased}
                    onChange={(e) => setPurchased(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="pkg-sessions-left" className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                    Sessions left
                  </label>
                  <input
                    id="pkg-sessions-left"
                    type="number"
                    min="0"
                    max="9999"
                    value={remaining}
                    onChange={(e) => {
                      setRemaining(Number(e.target.value));
                      if (Number(e.target.value) > 0) setUnpaid(0);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              {remaining === 0 && (
                <div>
                  <label htmlFor="pkg-unpaid-sessions" className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                    Unpaid sessions
                  </label>
                  <input
                    id="pkg-unpaid-sessions"
                    type="number"
                    min="0"
                    max="9999"
                    value={unpaid}
                    onChange={(e) => setUnpaid(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

    </>
  );
}
