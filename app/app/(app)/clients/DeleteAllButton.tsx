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
        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 hover:border-red-500/60 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={13} />
        Delete all ({count})
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#1e1e1d] border border-[#3d3d3c] text-[#f2f1ed]"
        >
          <DialogHeader>
            <DialogTitle className="text-[#f2f1ed]">
              Delete all {count} client{count !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="text-[#a3a29f] text-pretty">
              This will permanently remove all{" "}
              <span className="font-medium text-[#f2f1ed]">{count} client{count !== 1 ? "s" : ""}</span>{" "}
              and their session history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-transparent border-t border-[#3d3d3c]">
            <button
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="rounded-lg border border-[#3d3d3c] px-4 py-2 text-sm font-semibold text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={deleteAll}
              disabled={deleting}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : `Delete all ${count}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
