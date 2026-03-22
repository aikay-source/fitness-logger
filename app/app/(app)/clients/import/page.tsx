"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Sparkles,
  Settings2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ParsedRow = {
  name: string;
  totalSessionsPurchased: number;
  sessionsRemaining: number;
  unpaidSessions: number;
  phone?: string;
  valid: boolean;
  error?: string;
};

type ColumnMap = {
  name: string;
  totalSessionsPurchased: string;
  sessionsRemaining: string;
  unpaidSessions: string;
  phone: string;
};

type ImportMode = "ai" | "manual";

type AiClient = {
  name: string;
  totalSessionsPurchased: number;
  sessionsRemaining: number;
  unpaidSessions: number;
};

function guessColumn(headers: string[], hints: string[]): string {
  for (const hint of hints) {
    const match = headers.find((h) =>
      h.toLowerCase().replace(/[^a-z]/g, "").includes(hint.replace(/[^a-z]/g, ""))
    );
    if (match) return match;
  }
  return "";
}

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [importMode, setImportMode] = useState<ImportMode>("ai");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [aiClients, setAiClients] = useState<AiClient[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    name: "",
    totalSessionsPurchased: "",
    sessionsRemaining: "",
    unpaidSessions: "",
    phone: "",
  });
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<"upload" | "ai-parsing" | "map" | "confirm">("upload");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  function parseFile(file: File) {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: false,
        complete: (result) => {
          handleParsedGrid(result.data as string[][]);
        },
        error: () => toast.error("Failed to parse CSV."),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          defval: "",
        }) as string[][];
        handleParsedGrid(grid);
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Only CSV and Excel (.xlsx, .xls) files are supported.");
    }
  }

  function handleParsedGrid(grid: string[][], mode: ImportMode = importMode) {
    if (mode === "ai") {
      const cleanGrid = grid
        .map((row) => row.map((cell) => String(cell ?? "")))
        .filter((row) => row.some((cell) => cell.trim()));
      handleAiParse(cleanGrid);
    } else {
      const hdrs = (grid[0] ?? []).map(String);
      const rows = grid
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((row) => {
          const obj: Record<string, string> = {};
          hdrs.forEach((h, i) => {
            obj[h] = String(row[i] ?? "");
          });
          return obj;
        });
      setHeaders(hdrs);
      setRawRows(rows);
      autoMapAndAdvance(hdrs, rows);
    }
  }

  async function handleAiParse(grid: string[][]) {
    setStep("ai-parsing");
    try {
      const res = await fetch("/api/ai/parse-spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawData: grid }),
      });
      if (!res.ok) throw new Error("Server error");

      const { clients, error } = (await res.json()) as {
        clients: AiClient[];
        error?: string;
      };

      if (error || !clients?.length) {
        toast.error("AI couldn't extract clients. Switching to manual mapping.");
        handleParsedGrid(grid, "manual");
        setImportMode("manual");
        return;
      }

      setAiClients(clients);
      setPreview(
        clients.map((c) => ({
          name: c.name,
          totalSessionsPurchased: c.totalSessionsPurchased,
          sessionsRemaining: c.sessionsRemaining,
          unpaidSessions: c.unpaidSessions,
          valid: !!c.name,
          error: !c.name ? "Missing name" : undefined,
        }))
      );
      setStep("confirm");
    } catch {
      toast.error("AI parsing failed. Please try manual mapping.");
      setImportMode("manual");
      setStep("upload");
    }
  }

  function autoMapAndAdvance(hdrs: string[], rows: Record<string, string>[]) {
    const map: ColumnMap = {
      name: guessColumn(hdrs, ["name", "client", "fullname"]),
      totalSessionsPurchased: guessColumn(hdrs, [
        "total",
        "purchased",
        "bought",
        "package",
      ]),
      sessionsRemaining: guessColumn(hdrs, [
        "remaining",
        "left",
        "balance",
        "sessions",
      ]),
      unpaidSessions: guessColumn(hdrs, ["unpaid", "owing", "owed", "debt"]),
      phone: guessColumn(hdrs, ["phone", "mobile", "tel", "contact"]),
    };
    setColumnMap(map);
    setRawRows(rows);
    setStep("map");
  }

  function buildPreview() {
    const rows = rawRows.map((row) => {
      const name = row[columnMap.name]?.trim() ?? "";
      const purchased = Number(row[columnMap.totalSessionsPurchased]);
      const remaining = Number(row[columnMap.sessionsRemaining]);
      const unpaid = columnMap.unpaidSessions
        ? Number(row[columnMap.unpaidSessions])
        : 0;
      const phone = row[columnMap.phone]?.trim();

      let error: string | undefined;
      if (!name) error = "Missing name";
      else if (isNaN(purchased)) error = "Invalid total sessions";
      else if (isNaN(remaining)) error = "Invalid sessions remaining";

      return {
        name,
        totalSessionsPurchased: isNaN(purchased) ? 0 : purchased,
        sessionsRemaining: isNaN(remaining) ? 0 : remaining,
        unpaidSessions: isNaN(unpaid) ? 0 : unpaid,
        phone: phone || undefined,
        valid: !error,
        error,
      } satisfies ParsedRow;
    });
    setPreview(rows);
    setStep("confirm");
  }

  async function handleImport() {
    setImporting(true);

    let clients: Array<{
      name: string;
      totalSessionsPurchased: number;
      sessionsRemaining: number;
      unpaidSessions: number;
      phone?: string;
    }>;

    if (importMode === "ai") {
      clients = aiClients.filter((c) => c.name?.trim());
    } else {
      if (!columnMap.name) {
        toast.error("Name column is required.");
        setImporting(false);
        return;
      }
      clients = rawRows
        .map((row) => ({
          name: row[columnMap.name]?.trim() ?? "",
          totalSessionsPurchased:
            Number(row[columnMap.totalSessionsPurchased]) || 0,
          sessionsRemaining: Number(row[columnMap.sessionsRemaining]) || 0,
          unpaidSessions: columnMap.unpaidSessions
            ? Number(row[columnMap.unpaidSessions]) || 0
            : 0,
          phone: row[columnMap.phone]?.trim() || undefined,
        }))
        .filter((c) => c.name);
    }

    try {
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients }),
      });
      if (!res.ok) throw new Error();
      const { imported } = await res.json();
      toast.success(`${imported} client${imported !== 1 ? "s" : ""} imported!`);
      router.push("/clients");
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const totalToImport =
    importMode === "ai" ? aiClients.length : rawRows.length;

  const selectClass =
    "w-full rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-2 text-sm text-[#f2f1ed] focus:border-[#a3a29f] focus:outline-none transition-colors";
  const labelClass =
    "block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f] mb-1.5";

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      <div>
        <Link
          href="/clients"
          className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
        >
          <ChevronLeft size={13} />
          Clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f2f1ed]">
          Import clients
        </h1>
        <p className="mt-1 text-sm text-[#a3a29f]">
          Upload a CSV or Excel file with your client list.
        </p>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setImportMode("ai")}
              className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                importMode === "ai"
                  ? "border-[#f2f1ed] bg-[#1e1e1d]"
                  : "border-[#3d3d3c] bg-[#1a1a19] hover:border-[#5e5e5c]"
              }`}
            >
              <Sparkles
                size={16}
                className={
                  importMode === "ai" ? "text-[#f2f1ed]" : "text-[#5e5e5c]"
                }
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    importMode === "ai" ? "text-[#f2f1ed]" : "text-[#a3a29f]"
                  }`}
                >
                  Smart Import
                </p>
                <p className="mt-0.5 text-xs text-[#5e5e5c]">
                  AI reads any format
                </p>
              </div>
            </button>

            <button
              onClick={() => setImportMode("manual")}
              className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                importMode === "manual"
                  ? "border-[#f2f1ed] bg-[#1e1e1d]"
                  : "border-[#3d3d3c] bg-[#1a1a19] hover:border-[#5e5e5c]"
              }`}
            >
              <Settings2
                size={16}
                className={
                  importMode === "manual" ? "text-[#f2f1ed]" : "text-[#5e5e5c]"
                }
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    importMode === "manual"
                      ? "text-[#f2f1ed]"
                      : "text-[#a3a29f]"
                  }`}
                >
                  Manual Mapping
                </p>
                <p className="mt-0.5 text-xs text-[#5e5e5c]">
                  Match columns yourself
                </p>
              </div>
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) parseFile(file);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#3d3d3c] bg-[#1e1e1d] p-10 hover:border-[#5e5e5c] transition-colors"
          >
            <Upload size={24} className="text-[#5e5e5c]" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#f2f1ed]">
                Choose a file
              </p>
              <p className="mt-0.5 text-xs text-[#5e5e5c]">
                CSV, XLSX or XLS
              </p>
            </div>
          </button>

          {importMode === "manual" && (
            <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4 space-y-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                Expected columns
              </p>
              <p className="text-xs text-[#5e5e5c]">
                Name · Total Sessions Purchased · Sessions Remaining · Unpaid
                Sessions · Phone — all optional except Name
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Parsing loading */}
      {step === "ai-parsing" && (
        <div className="flex flex-col items-center gap-5 py-16">
          <Loader2 size={28} className="animate-spin text-[#a3a29f]" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-[#f2f1ed]">
              Analysing your spreadsheet
            </p>
            <p className="text-xs text-[#5e5e5c]">
              AI is reading the format and extracting clients…
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#1e1e1d] border border-[#3d3d3c] px-4 py-3">
            <FileText size={14} className="text-[#a3a29f] shrink-0" />
            <p className="text-sm text-[#f2f1ed] truncate">{fileName}</p>
          </div>
        </div>
      )}

      {/* Step 2: Map columns (manual only) */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#1e1e1d] border border-[#3d3d3c] px-4 py-3">
            <FileText size={14} className="text-[#a3a29f] shrink-0" />
            <p className="text-sm text-[#f2f1ed] truncate">{fileName}</p>
            <span className="ml-auto font-mono text-xs text-[#5e5e5c]">
              {rawRows.length} rows
            </span>
          </div>

          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Match your columns
          </p>

          {(
            [
              { key: "name", label: "Client name", required: true },
              {
                key: "totalSessionsPurchased",
                label: "Sessions purchased",
                required: false,
              },
              {
                key: "sessionsRemaining",
                label: "Sessions remaining",
                required: false,
              },
              {
                key: "unpaidSessions",
                label: "Unpaid sessions",
                required: false,
              },
              { key: "phone", label: "Phone", required: false },
            ] as const
          ).map(({ key, label, required }) => (
            <div key={key}>
              <label className={labelClass}>
                {label}{" "}
                {required && (
                  <span className="text-red-400 normal-case">*</span>
                )}
              </label>
              <select
                value={columnMap[key]}
                onChange={(e) =>
                  setColumnMap((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">— skip —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            onClick={buildPreview}
            disabled={!columnMap.name}
            className="w-full rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-40 transition-colors"
          >
            Preview →
          </button>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-4 space-y-1">
            {importMode === "ai" && (
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-[#a3a29f]" />
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                  AI extracted
                </p>
              </div>
            )}
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
              {totalToImport} client{totalToImport !== 1 ? "s" : ""} ready to import
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
            {preview.map((row, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {row.valid ? (
                  <Check size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#f2f1ed]">
                    {row.name || (
                      <span className="text-[#5e5e5c]">(unnamed)</span>
                    )}
                  </p>
                  {row.error ? (
                    <p className="text-xs text-red-400">{row.error}</p>
                  ) : (
                    <p className="font-mono text-xs text-[#5e5e5c]">
                      {row.totalSessionsPurchased > 0 ? (
                        <>
                          {row.sessionsRemaining} of {row.totalSessionsPurchased} sessions left
                        </>
                      ) : (
                        <>No package</>
                      )}
                      {row.unpaidSessions > 0 && (
                        <span className="ml-2 text-purple-400">
                          · {row.unpaidSessions} unpaid
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(importMode === "ai" ? "upload" : "map")}
              className="flex-1 rounded-lg border border-[#3d3d3c] py-2.5 text-sm font-semibold text-[#a3a29f] hover:border-[#5e5e5c] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
            >
              {importing
                ? "Importing…"
                : `Import ${totalToImport} client${totalToImport !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
