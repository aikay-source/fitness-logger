"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, DollarSign } from "lucide-react";

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
          // Only persist unpaid when balance is zero; clear it if sessions were added
          unpaidSessions: remaining === 0 ? unpaid : 0,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Package updated.");
      setEditing(false);
    } catch {
      toast.error("Failed to update.");
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
      toast.error("Failed to update.");
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
    "w-full rounded-lg border border-[#3d3d3c] bg-[#141413] px-3 py-1.5 text-sm text-[#f2f1ed] focus:border-[#a3a29f] focus:outline-none transition-colors";

  return (
    <>
      {/* Unpaid sessions card */}
      {unpaid > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Unpaid sessions
          </h2>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign size={16} className="text-purple-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#f2f1ed]">
                    {unpaid} session{unpaid !== 1 ? "s" : ""} owed
                  </p>
                  <p className="text-xs text-purple-300">
                    Trained without remaining balance
                  </p>
                </div>
              </div>
              <button
                onClick={markSettled}
                disabled={settling}
                className="rounded-lg bg-purple-500/30 px-3 py-1.5 font-mono text-xs font-semibold text-purple-300 hover:bg-purple-500/50 disabled:opacity-50 transition-colors"
              >
                {settling ? "…" : "Mark settled"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Package card */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Package
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className="flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
              >
                <X size={11} />
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 font-mono text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
              >
                <Check size={11} />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4 space-y-4">
          {!editing ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-3xl font-semibold text-[#f2f1ed]">
                    {remaining}
                  </p>
                  <p className="mt-0.5 text-xs text-[#a3a29f]">
                    of {purchased} sessions remaining
                  </p>
                </div>
                <p className="font-mono text-sm text-[#5e5e5c]">
                  {percentUsed}% used
                </p>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#3d3d3c]">
                <div
                  className="h-full rounded-full bg-[#f2f1ed] transition-all"
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                    Sessions bought
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purchased}
                    onChange={(e) => setPurchased(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                    Sessions left
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={remaining}
                    onChange={(e) => {
                      setRemaining(Number(e.target.value));
                      // Clear unpaid if sessions are being added back
                      if (Number(e.target.value) > 0) setUnpaid(0);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              {remaining === 0 && (
                <div>
                  <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                    Unpaid sessions
                  </label>
                  <input
                    type="number"
                    min="0"
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
