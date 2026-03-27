"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteClient() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`${clientName} removed.`);
      router.push("/clients");
    } catch {
      toast.error("Failed to delete client.");
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="space-y-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
          Danger zone
        </h2>
        <div className="rounded-xl border border-red-500/20 bg-[var(--app-surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--app-text)]">Remove client</p>
              <p className="text-xs text-[var(--app-muted)]">
                Deletes this client and all their session history.
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 font-mono text-xs font-semibold text-red-500 hover:border-red-500/60 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)]"
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--app-text)]">Delete {clientName}?</DialogTitle>
            <DialogDescription className="text-[var(--app-tertiary)] text-pretty">
              This will permanently remove{" "}
              <span className="font-medium text-[var(--app-text)]">{clientName}</span> and all
              their session history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-transparent border-t border-[var(--app-border)]">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-tertiary)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={deleteClient}
              disabled={deleting}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : "Delete client"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
