"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { PlusCircle, Upload, Download, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  ParseSpreadsheetResult,
  ParsedSessionEntry,
} from "@/app/api/ai/parse-spreadsheet/route";

interface AddClientsModalProps {
  existingNames: string[];
  triggerVariant?: "header" | "empty-state";
}

type BulkStep = "upload" | "parsing" | "preview" | "error";

type BulkRow = {
  name: string;
  totalSessionsPurchased: number;
  sessionsUsed: number;
  unpaidSessions: number;
  valid: boolean;
  isDuplicate: boolean;
};

const MAX_AI_ROWS = 200;

const inputClass =
  "w-full rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-2.5 text-sm text-[#f2f1ed] placeholder:text-[#5e5e5c] focus:border-[#a3a29f] focus:outline-none transition-colors";
const labelClass =
  "block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f] mb-1.5";

export default function AddClientsModal({
  existingNames,
  triggerVariant = "header",
}: AddClientsModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Single tab state
  const [form, setForm] = useState({
    name: "",
    totalSessionsPurchased: "",
    sessionsUsed: "",
    unpaidSessions: "",
    lastSessionDate: "",
  });
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bulk tab state
  const [bulkStep, setBulkStep] = useState<BulkStep>("upload");
  const [parsedRows, setParsedRows] = useState<BulkRow[]>([]);
  const [parsedSessions, setParsedSessions] = useState<ParsedSessionEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingNamesLower = existingNames.map((n) => n.toLowerCase().trim());

  // Show unpaid only when sessions used >= sessions purchased
  const showUnpaid =
    form.sessionsUsed !== "" &&
    form.totalSessionsPurchased !== "" &&
    Number(form.sessionsUsed) >= Number(form.totalSessionsPurchased);

  function resetState() {
    setForm({ name: "", totalSessionsPurchased: "", sessionsUsed: "", unpaidSessions: "", lastSessionDate: "" });
    setNameError(false);
    setBulkStep("upload");
    setParsedRows([]);
    setParsedSessions(null);
    setParseError(null);
    setFileError(null);
    setTruncated(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(v: boolean) {
    if (!v) resetState();
    setOpen(v);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "name") setNameError(false);
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    const totalSessionsPurchased = Math.max(0, Number(form.totalSessionsPurchased) || 0);
    const sessionsUsed = Math.max(0, Number(form.sessionsUsed) || 0);
    const sessionsRemaining = Math.max(0, totalSessionsPurchased - sessionsUsed);
    const unpaidSessions = sessionsRemaining === 0 ? Math.max(0, Number(form.unpaidSessions) || 0) : 0;

    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          totalSessionsPurchased,
          sessionsRemaining,
          unpaidSessions,
          lastSessionDate: form.lastSessionDate || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const client = await res.json();
      toast.success(`${client.name} added!`);
      setForm({ name: "", totalSessionsPurchased: "", sessionsUsed: "", unpaidSessions: "", lastSessionDate: "" });
    } catch {
      toast.error("Failed to add client. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    router.refresh();
    setOpen(false);
    resetState();
  }

  // ── Bulk helpers ──────────────────────────────────────────────────────────

  function downloadTemplate() {
    const csv = Papa.unparse({
      fields: ["Name", "Sessions Bought", "Sessions Used", "Unpaid Sessions", "Phone"],
      data: [],
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function aggregateSessionHistory(sessions: ParsedSessionEntry[]): BulkRow[] {
    const byName = new Map<
      string,
      { maxSessionNum: number; maxUnpaidNum: number; packageSizes: Set<number> }
    >();
    for (const s of sessions) {
      const e = byName.get(s.name) ?? { maxSessionNum: 0, maxUnpaidNum: 0, packageSizes: new Set<number>() };
      if (s.paid && s.sessionNumber !== null) {
        // Paid entry like "Kate9/11" → 9 sessions used out of 11 bought
        e.maxSessionNum = Math.max(e.maxSessionNum, s.sessionNumber);
      }
      if (!s.paid && s.sessionNumber !== null) {
        // Unpaid entry like "Lulu3/u" → 3 unpaid sessions
        e.maxUnpaidNum = Math.max(e.maxUnpaidNum, s.sessionNumber);
      }
      if (s.packageSize !== null) e.packageSizes.add(s.packageSize);
      byName.set(s.name, e);
    }
    return [...byName.entries()].map(([name, e]) => {
      const packageSize = e.packageSizes.size === 1 ? [...e.packageSizes][0] : 0;
      return {
        name,
        totalSessionsPurchased: packageSize,
        sessionsUsed: e.maxSessionNum,
        unpaidSessions: e.maxUnpaidNum,
        valid: name.trim().length > 0,
        isDuplicate: existingNamesLower.includes(name.trim().toLowerCase()),
      };
    });
  }

  function mapRosterToRows(
    clients: { name: string; totalSessionsPurchased: number; sessionsRemaining: number; unpaidSessions: number }[]
  ): BulkRow[] {
    return clients.map((c) => ({
      name: c.name,
      totalSessionsPurchased: c.totalSessionsPurchased,
      sessionsUsed: Math.max(0, c.totalSessionsPurchased - c.sessionsRemaining),
      unpaidSessions: c.unpaidSessions,
      valid: c.name.trim().length > 0,
      isDuplicate: existingNamesLower.includes(c.name.trim().toLowerCase()),
    }));
  }

  function updateRow(i: number, field: keyof BulkRow, raw: string) {
    setParsedRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "name") {
          const trimmed = raw;
          return {
            ...r,
            name: trimmed,
            valid: trimmed.trim().length > 0,
            isDuplicate: existingNamesLower.includes(trimmed.trim().toLowerCase()),
          };
        }
        return { ...r, [field]: Math.max(0, Number(raw) || 0) };
      })
    );
  }

  async function handleFileWithAI(file: File) {
    setFileError(null);
    setParseError(null);
    setTruncated(false);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setFileError("Only .csv and .xlsx files are supported.");
      return;
    }

    function processGrid(rawGrid: string[][]) {
      let grid = rawGrid;
      let wasTruncated = false;
      if (grid.length > MAX_AI_ROWS + 1) {
        grid = grid.slice(0, MAX_AI_ROWS + 1); // keep header + MAX_AI_ROWS data rows
        wasTruncated = true;
      }
      setTruncated(wasTruncated);
      sendToAI(grid);
    }

    async function sendToAI(grid: string[][]) {
      setBulkStep("parsing");
      try {
        const res = await fetch("/api/ai/parse-spreadsheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawData: grid }),
        });
        if (!res.ok) throw new Error("AI request failed");

        const result: ParseSpreadsheetResult = await res.json();

        if (result.format === "unknown") {
          setParseError(result.error || "The AI couldn't understand the file structure.");
          setBulkStep("error");
          return;
        }

        if (result.format === "client-roster") {
          const rows = mapRosterToRows(result.clients);
          if (rows.length === 0) {
            setParseError("No client data found in the file.");
            setBulkStep("error");
            return;
          }
          setParsedSessions(null);
          setParsedRows(rows);
        } else {
          // Session history — store raw sessions for import
          if (result.sessions.length === 0) {
            setParseError("No session data found in the file.");
            setBulkStep("error");
            return;
          }
          setParsedSessions(result.sessions);
          setParsedRows(aggregateSessionHistory(result.sessions));
        }
        setBulkStep("preview");
      } catch {
        setParseError("Something went wrong while analysing your file. Please try again.");
        setBulkStep("error");
      }
    }

    if (ext === "csv") {
      Papa.parse<string[]>(file, {
        complete(result) {
          processGrid(result.data as string[][]);
        },
        error() {
          setFileError("Failed to parse CSV file.");
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
          processGrid(grid);
        } catch {
          setFileError("Failed to parse Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileWithAI(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileWithAI(file);
  }

  async function handleBulkImport() {
    setImporting(true);
    try {
      if (parsedSessions) {
        // Session-history: import individual sessions (auto-creates clients + packages)
        const validNames = new Set(
          parsedRows.filter((r) => r.valid).map((r) => r.name.trim().toLowerCase())
        );
        const sessions = parsedSessions.filter((s) =>
          validNames.has(s.name.trim().toLowerCase())
        );
        const res = await fetch("/api/sessions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        toast.success(
          `${data.imported} session${data.imported !== 1 ? "s" : ""} imported for ${data.clients} client${data.clients !== 1 ? "s" : ""}!`
        );
      } else {
        // Client-roster: import client summaries only
        const validRows = parsedRows.filter((r) => r.valid);
        if (validRows.length === 0) return;
        const clients = validRows.map((r) => ({
          name: r.name,
          totalSessionsPurchased: r.totalSessionsPurchased,
          sessionsRemaining: Math.max(0, r.totalSessionsPurchased - r.sessionsUsed),
          unpaidSessions: r.unpaidSessions,
        }));
        const res = await fetch("/api/clients/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clients }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { imported } = await res.json();
        toast.success(`${imported} client${imported !== 1 ? "s" : ""} imported!`);
      }
      router.refresh();
      setOpen(false);
      resetState();
    } catch {
      toast.error("Failed to import. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function goBackToUpload() {
    setBulkStep("upload");
    setParsedRows([]);
    setParsedSessions(null);
    setParseError(null);
    setFileError(null);
    setTruncated(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const validCount = parsedRows.filter((r) => r.valid).length;
  const totalSessionCount = parsedSessions?.length ?? 0;

  // Group sessions by client for the session-history preview
  const sessionsByClient = parsedSessions
    ? parsedRows.map((row) => ({
        ...row,
        sessions: parsedSessions
          .filter((s) => s.name.trim().toLowerCase() === row.name.trim().toLowerCase())
          .sort((a, b) => a.date.localeCompare(b.date)),
      }))
    : null;

  const trigger =
    triggerVariant === "empty-state" ? (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#f2f1ed] px-4 py-2 text-sm font-semibold text-[#141413] hover:bg-white active:scale-[0.96] transition-[background-color,transform]"
      >
        <PlusCircle size={14} />
        Add your first client
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-[#f2f1ed] px-3 py-2 text-xs font-semibold text-[#141413] hover:bg-white active:scale-[0.96] transition-[background-color,transform]"
      >
        <PlusCircle size={13} />
        Add clients
      </button>
    );

  // Inline cell input styles
  const cellInputClass =
    "w-full bg-transparent text-[#f2f1ed] focus:outline-none border-b border-transparent focus:border-[#a3a29f] transition-colors";
  const cellNumInputClass =
    "w-full bg-transparent text-right text-[#a3a29f] focus:outline-none border-b border-transparent focus:border-[#a3a29f] transition-colors";

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-[#1e1e1d] border border-[#3d3d3c] text-[#f2f1ed] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#f2f1ed]">Add clients</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="single">
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">
                Single
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">
                Bulk
              </TabsTrigger>
            </TabsList>

            {/* ── Single Tab ──────────────────────────────────────────────── */}
            <TabsContent value="single">
              <form onSubmit={handleSingleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="modal-name" className={labelClass}>
                    Full name *
                  </label>
                  <input
                    id="modal-name"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="Alex Johnson"
                    maxLength={100}
                    className={inputClass + (nameError ? " !border-red-500" : "")}
                  />
                  {nameError && (
                    <p className="mt-1 text-xs text-red-400">Name is required</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="modal-purchased" className={labelClass}>
                      Sessions bought
                    </label>
                    <input
                      id="modal-purchased"
                      name="totalSessionsPurchased"
                      type="number"
                      min="0"
                      value={form.totalSessionsPurchased}
                      onChange={handleFormChange}
                      placeholder="10"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-used" className={labelClass}>
                      Sessions used
                    </label>
                    <input
                      id="modal-used"
                      name="sessionsUsed"
                      type="number"
                      min="0"
                      value={form.sessionsUsed}
                      onChange={handleFormChange}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-last-session" className={labelClass}>
                    Last session date{" "}
                    <span className="normal-case text-[#5e5e5c]">(optional)</span>
                  </label>
                  <input
                    id="modal-last-session"
                    name="lastSessionDate"
                    type="date"
                    value={form.lastSessionDate}
                    onChange={handleFormChange}
                    className={inputClass}
                  />
                </div>

                {showUnpaid && (
                  <div>
                    <label htmlFor="modal-unpaid" className={labelClass}>
                      Unpaid sessions{" "}
                      <span className="normal-case text-[#5e5e5c]">(optional)</span>
                    </label>
                    <input
                      id="modal-unpaid"
                      name="unpaidSessions"
                      type="number"
                      min="0"
                      value={form.unpaidSessions}
                      onChange={handleFormChange}
                      placeholder="0"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-[#5e5e5c]">
                      Sessions trained that haven&apos;t been paid for yet.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white active:scale-[0.96] disabled:opacity-50 transition-[background-color,transform]"
                  >
                    {submitting ? "Adding…" : "Add client"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDone}
                    className="rounded-lg border border-[#3d3d3c] px-4 py-2.5 text-sm font-semibold text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] active:scale-[0.96] transition-[border-color,color,transform]"
                  >
                    Done
                  </button>
                </div>
              </form>
            </TabsContent>

            {/* ── Bulk Tab ────────────────────────────────────────────────── */}
            <TabsContent value="bulk">
              <div className="mt-4 space-y-4">

                {/* Upload step */}
                {bulkStep === "upload" && (
                  <>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 text-sm font-medium text-[#a3a29f] hover:text-[#f2f1ed] transition-colors"
                    >
                      <Download size={14} />
                      Download template
                    </button>

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-lg border border-dashed border-[#3d3d3c] p-8 text-center hover:border-[#5e5e5c] transition-colors"
                    >
                      <Upload size={20} className="mx-auto mb-2 text-[#5e5e5c]" />
                      <p className="text-sm text-[#a3a29f]">
                        Drop any CSV or Excel file here
                      </p>
                      <p className="mt-1 text-xs text-[#5e5e5c]">
                        AI will extract names and session data automatically
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </div>

                    {fileError && (
                      <p className="flex items-center gap-1.5 text-sm text-red-400">
                        <AlertTriangle size={14} />
                        {fileError}
                      </p>
                    )}
                  </>
                )}

                {/* Parsing step */}
                {bulkStep === "parsing" && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 size={24} className="animate-spin text-[#a3a29f]" />
                    <p className="text-sm text-[#a3a29f]">Analysing your file…</p>
                  </div>
                )}

                {/* Error step */}
                {bulkStep === "error" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <p className="flex items-start gap-2 text-sm text-red-400">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>
                          {parseError || "The AI couldn't understand the file structure."}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={goBackToUpload}
                      className="w-full rounded-lg border border-[#3d3d3c] py-2.5 text-sm font-semibold text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] transition-colors"
                    >
                      Try a different file
                    </button>
                  </div>
                )}

                {/* Preview step */}
                {bulkStep === "preview" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#a3a29f]">
                          {validCount} client{validCount !== 1 ? "s" : ""}{parsedSessions ? `, ${totalSessionCount} session${totalSessionCount !== 1 ? "s" : ""}` : ""} ready to import
                        </p>
                        {truncated && (
                          <p className="mt-0.5 text-xs text-amber-400">
                            Only the first {MAX_AI_ROWS} rows were analysed
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={goBackToUpload}
                        className="font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
                      >
                        ← Back
                      </button>
                    </div>

                    {/* Session-history preview: grouped by client with dates */}
                    {sessionsByClient ? (
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {sessionsByClient.map((client, i) => (
                          <details key={i} className="group rounded-lg border border-[#3d3d3c] bg-[#141413]" open={i === 0}>
                            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 list-none hover:bg-[#1e1e1d] transition-colors rounded-lg">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm text-[#f2f1ed] truncate">{client.name}</span>
                                {client.isDuplicate && (
                                  <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                                    exists
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 font-mono text-xs text-[#5e5e5c]">
                                {client.sessions.length} session{client.sessions.length !== 1 ? "s" : ""}
                                {client.totalSessionsPurchased > 0 && ` · ${client.sessionsUsed}/${client.totalSessionsPurchased}`}
                                {client.unpaidSessions > 0 && ` · ${client.unpaidSessions} unpaid`}
                              </span>
                            </summary>
                            <div className="border-t border-[#3d3d3c] px-3 py-1">
                              {client.sessions.map((s, j) => (
                                <div key={j} className="flex items-center justify-between py-1 text-xs">
                                  <span className="font-mono text-[#a3a29f]">
                                    {new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {s.sessionNumber !== null && s.packageSize !== null && (
                                      <span className="font-mono text-[#5e5e5c]">
                                        {s.sessionNumber}/{s.packageSize}
                                      </span>
                                    )}
                                    {s.sessionNumber !== null && s.packageSize === null && (
                                      <span className="font-mono text-[#5e5e5c]">
                                        {s.sessionNumber}/u
                                      </span>
                                    )}
                                    {!s.paid && (
                                      <span className="font-mono text-orange-400">unpaid</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      /* Client-roster preview: editable table */
                      <div className="max-h-60 overflow-y-auto rounded-lg border border-[#3d3d3c]">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 z-10">
                            <tr className="border-b border-[#3d3d3c] bg-[#141413]">
                              <th className="px-3 py-2 text-left font-mono font-semibold uppercase tracking-widest text-[#5e5e5c]">
                                Name
                              </th>
                              <th className="px-3 py-2 text-right font-mono font-semibold uppercase tracking-widest text-[#5e5e5c]">
                                Bought
                              </th>
                              <th className="px-3 py-2 text-right font-mono font-semibold uppercase tracking-widest text-[#5e5e5c]">
                                Used
                              </th>
                              <th className="px-3 py-2 text-right font-mono font-semibold uppercase tracking-widest text-[#5e5e5c]">
                                Unpaid
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.map((row, i) => {
                              const overUsed =
                                row.totalSessionsPurchased > 0 &&
                                row.sessionsUsed > row.totalSessionsPurchased;
                              return (
                                <tr
                                  key={i}
                                  className="border-b border-[#3d3d3c] last:border-0"
                                >
                                  <td className="px-3 py-1.5 text-[#f2f1ed]">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={row.name}
                                        onChange={(e) => updateRow(i, "name", e.target.value)}
                                        placeholder="name…"
                                        maxLength={100}
                                        className={cellInputClass + " min-w-0 flex-1"}
                                      />
                                      {!row.valid && (
                                        <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">
                                          invalid
                                        </span>
                                      )}
                                      {row.isDuplicate && (
                                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                                          duplicate
                                        </span>
                                      )}
                                      {overUsed && (
                                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                                          check values
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.totalSessionsPurchased || ""}
                                      onChange={(e) =>
                                        updateRow(i, "totalSessionsPurchased", e.target.value)
                                      }
                                      placeholder="—"
                                      className={cellNumInputClass}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.sessionsUsed || ""}
                                      onChange={(e) =>
                                        updateRow(i, "sessionsUsed", e.target.value)
                                      }
                                      placeholder="—"
                                      className={cellNumInputClass}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.unpaidSessions || ""}
                                      onChange={(e) =>
                                        updateRow(i, "unpaidSessions", e.target.value)
                                      }
                                      placeholder="—"
                                      className={cellNumInputClass}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleBulkImport}
                      disabled={importing || validCount === 0}
                      className="w-full rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white active:scale-[0.96] disabled:opacity-50 transition-[background-color,transform]"
                    >
                      {importing ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Importing…
                        </span>
                      ) : parsedSessions ? (
                        `Import ${totalSessionCount} session${totalSessionCount !== 1 ? "s" : ""} for ${validCount} client${validCount !== 1 ? "s" : ""}`
                      ) : (
                        `Import ${validCount} client${validCount !== 1 ? "s" : ""}`
                      )}
                    </button>
                  </>
                )}

              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
