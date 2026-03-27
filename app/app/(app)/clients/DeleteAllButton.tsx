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

export default function DeleteAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAll() {
    setDeleting(true);
    try {
      const res = await fetch("/api/clients", { method: "DELETE" });
      if (!res.ok) throw new Error();
      const { deleted } = await res.json();
      toast.success(`${deleted} client${deleted !== 1 ? "s" : ""} removed.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't delete clients. Try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-500 hover:border-red-500/60 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={13} />
        Delete all ({count})
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)]"
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--app-text)]">
              Delete all {count} client{count !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="text-[var(--app-tertiary)] text-pretty">
              This will permanently remove all{" "}
              <span className="font-medium text-[var(--app-text)]">{count} client{count !== 1 ? "s" : ""}</span>{" "}
              and their session history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-transparent border-t border-[var(--app-border)]">
            <button
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-tertiary)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={deleteAll}
              disabled={deleting}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : `Delete all ${count}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
