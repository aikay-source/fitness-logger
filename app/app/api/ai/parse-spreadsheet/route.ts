export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import { aiParseLimiter, checkRateLimit } from "@/lib/rate-limit";

// Kept for any consumers that imported this type
export type ParsedSessionEntry = {
  date: string;
  name: string;
  sessionNumber: number | null;
  packageSize: number | null;
  paid: boolean;
};

export type ParseSpreadsheetResult =
  | { format: "client-roster"; clients: { name: string; totalSessionsPurchased: number; sessionsRemaining: number; unpaidSessions: number }[] }
  | { format: "session-history"; sessions: ParsedSessionEntry[] }
  | { format: "unknown"; error: string };

// Matches cells like "Kate9/11", "Lulu3/u", "Dasha 2/u", "Philip"
const SESSION_GRID_CELL = /^[a-zA-ZÀ-ÿ][\w\s'-]*\s*(\d+\s*\/\s*(\d+|u))?$/i;
const HEADER_PATTERN = /^(names?\s+of|session\s+count|total\s+sessions|date|month|week|facility|charge)/i;

// ─── Date detection & normalisation ──────────────────────────────────────────

function isDateCell(cell: string): boolean {
  const s = cell.trim();
  if (!s) return false;
  // ISO: 2024-09-03 or 2024-9-3
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return true;
  // DD/MM/YYYY or MM/DD/YYYY (2 or 4-digit year)
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(s)) return true;
  // Excel serial number (approx range covers 2000–2040)
  const n = Number(s);
  if (/^\d{5}$/.test(s) && n >= 36526 && n <= 51544) return true;
  return false;
}

/**
 * Scans all date-like cells to determine whether the spreadsheet uses
 * MM/DD or DD/MM ordering.  Returns "mdy" or "dmy".
 *
 * Heuristic:
 *  - If any cell has first number > 12 → must be DD/MM (dmy)
 *  - If any cell has second number > 12 → must be MM/DD (mdy)
 *  - If all ambiguous, default to MM/DD (most common in US-style sheets)
 */
function detectDateOrder(cells: string[]): "mdy" | "dmy" {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const raw of cells) {
    const m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]\d{2,4}$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) firstOver12 = true;
    if (b > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return "dmy";
  // Default to MM/DD
  return "mdy";
}

/**
 * Converts any recognised date string to "YYYY-MM-DD" deterministically.
 * `order` controls how ambiguous A/B/YYYY dates are interpreted.
 * Returns null if the string cannot be parsed.
 */
function normalizeDateToISO(raw: string, order: "mdy" | "dmy" = "mdy"): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO: 2024-09-03 or 2024-9-3
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // A/B/YYYY or A-B-YYYY (slash or dash separators)
  const abMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (abMatch) {
    const a = Number(abMatch[1]);
    const b = Number(abMatch[2]);
    const yearRaw = Number(abMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

    let month: number, day: number;
    if (a > 12) {
      // First number can't be a month, must be day
      day = a; month = b;
    } else if (b > 12) {
      // Second number can't be a month, must be day
      month = a; day = b;
    } else {
      // Ambiguous — use detected order
      if (order === "mdy") { month = a; day = b; }
      else { day = a; month = b; }
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Excel serial number (days since 1899-12-30)
  const n = Number(s);
  if (/^\d{5}$/.test(s) && n >= 36526 && n <= 51544) {
    const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

function isSessionHistoryGrid(rawData: string[][]): boolean {
  const colA = rawData
    .map((row) => String(row[0] ?? "").trim())
    .filter((c) => c.length > 0);
  if (colA.length < 2) return false;
  const dateCount = colA.filter(isDateCell).length;
  return dateCount / colA.length >= 0.4;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { limited } = await checkRateLimit(aiParseLimiter, `ai-parse:${session.user.id}`);
  if (limited) return new NextResponse("Too many requests", { status: 429 });

  const { rawData: rawInput } = (await req.json()) as { rawData: unknown };

  if (!Array.isArray(rawInput) || rawInput.length === 0) {
    return NextResponse.json({ format: "unknown", error: "No data provided" });
  }

  // Cap rows and columns to prevent runaway Groq token usage
  const rawData = (rawInput as unknown[][])
    .slice(0, 200)
    .map((row) => (Array.isArray(row) ? row.slice(0, 20).map(String) : []));

  if (rawData.length === 0) {
    return NextResponse.json({ format: "unknown", error: "No data provided" });
  }

  // Dated session-history grid takes priority (col A = dates, cells = attendance)
  if (isSessionHistoryGrid(rawData)) {
    return handleSessionHistory(rawData);
  }

  // Flatten all non-empty, non-header cells
  const allCells = rawData
    .flat()
    .map((cell) => String(cell ?? "").trim())
    .filter((cell) => cell.length > 0 && !HEADER_PATTERN.test(cell));

  if (allCells.length === 0) {
    return NextResponse.json({ format: "unknown", error: "No data found" });
  }

  // Detect session-grid format: majority of cells match "Name X/Y" or "Name X/u" or bare "Name"
  const gridMatches = allCells.filter((c) => SESSION_GRID_CELL.test(c)).length;
  const isSessionGrid = gridMatches / allCells.length > 0.5;

  if (isSessionGrid) {
    return handleSessionGrid(allCells);
  } else {
    return handleRosterFormat(allCells);
  }
}

// ─── Session-history: col A = dates, remaining cols = client entries ──────────

async function handleSessionHistory(rawData: string[][]): Promise<NextResponse> {
  // Check whether the first non-date row looks like a column-header row (client names)
  const firstRow = rawData[0] ?? [];
  const firstRowIsHeader =
    !isDateCell(String(firstRow[0] ?? "").trim()) &&
    firstRow.slice(1).some((c) => String(c ?? "").trim().length > 0);

  // Build column name list from the header row (if present)
  const columnNames: string[] = firstRowIsHeader
    ? firstRow.slice(1).map((c) => String(c ?? "").trim())
    : [];

  // Detect date format (MM/DD vs DD/MM) across all date cells in column A
  const dateCells = rawData.map((row) => String(row[0] ?? "").trim()).filter(isDateCell);
  const dateOrder = detectDateOrder(dateCells);
  console.log("[parse-spreadsheet] detected date order:", dateOrder);

  // Build "DATE: cell1, cell2, ..." lines for rows that have a recognisable date in col A.
  // Dates are pre-normalised to ISO here so the AI never has to guess the format.
  const rows = rawData
    .filter((row) => isDateCell(String(row[0] ?? "").trim()))
    .map((row) => {
      const dateRaw = String(row[0] ?? "").trim();
      const dateISO = normalizeDateToISO(dateRaw, dateOrder);
      if (!dateISO) return null;
      const cells = row.slice(1).map((c) => String(c ?? "").trim());

      // If we have column headers, prefix each non-empty cell with the column name
      const labeled =
        columnNames.length > 0
          ? cells
              .map((c, i) => {
                if (!c) return null;
                const colName = columnNames[i] ?? "";
                // If cell already starts with the name, don't double-up
                return colName && !c.toLowerCase().startsWith(colName.toLowerCase())
                  ? `${colName}:${c}`
                  : c;
              })
              .filter(Boolean)
          : cells.filter((c) => c.length > 0);

      return labeled.length > 0 ? `${dateISO}: ${labeled.join(", ")}` : null;
    })
    .filter(Boolean) as string[];

  if (rows.length === 0) {
    return NextResponse.json({ format: "unknown", error: "No dated session rows found" });
  }

  const content = rows.join("\n");
  console.log("[parse-spreadsheet] session-history rows:\n", content.slice(0, 800));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are extracting session attendance from a personal trainer's date-log spreadsheet.

Each line format: "DATE: entry1, entry2, ..."

Each entry is ONE attendance record for ONE client on that date. Entry formats:

A) Name embedded in value:
   "Kate9/11"  → client=Kate, this is her 9th session of an 11-session package, paid=true
   "Lulu3/u"   → client=Lulu, this is her 3rd unpaid session (no package), paid=false
   "Philip"    → client=Philip, attended, no package, paid=false

B) Name given as prefix (ColName:value):
   "Kate:9/11" → client=Kate, 9th session of 11-session package, paid=true
   "Lulu:3/u"  → client=Lulu, 3rd unpaid session, paid=false
   "Kate:x" or "Kate:1" → client=Kate, attended (unpaid, no package info)

CRITICAL: Each entry = EXACTLY ONE session record. "Lulu3/u" is ONE session (her 3rd), not 3 sessions.

Dates are already in YYYY-MM-DD format — copy them exactly as given, do NOT reformat.
Clean client names: strip trailing digits, slashes, "u", "x", extra spaces, colons.

Return ONLY valid JSON:
{
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "name": "string",
      "sessionNumber": number | null,
      "packageSize": number | null,
      "paid": boolean
    }
  ]
}

Rules:
- "Kate9/11" or "Kate:9/11" → sessionNumber: 9, packageSize: 11, paid: true
- "Lulu3/u"  or "Lulu:3/u"  → sessionNumber: 3, packageSize: null, paid: false
- "Philip"   or "Philip:x"  → sessionNumber: null, packageSize: null, paid: false
- Skip completely empty cells (no entry to extract)`,
        },
        { role: "user", content: content },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"sessions":[]}';
    console.log("[parse-spreadsheet] session-history AI response:", raw.slice(0, 600));

    const parsed = JSON.parse(raw) as { sessions: ParsedSessionEntry[] };
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : [])
      .filter((s) => s.name?.trim() && DATE_RE.test(s.date ?? ""))
      .map((s) => ({
        date: s.date,
        name: s.name.trim(),
        sessionNumber: s.sessionNumber != null ? Math.max(1, Number(s.sessionNumber) || 1) : null,
        packageSize: s.packageSize != null ? Math.max(1, Number(s.packageSize) || 1) : null,
        paid: Boolean(s.paid),
      }));

    if (sessions.length === 0) {
      return NextResponse.json({ format: "unknown", error: "No sessions could be extracted" });
    }

    return NextResponse.json({ format: "session-history", sessions });
  } catch (err) {
    console.error("[parse-spreadsheet] Groq error (session-history):", err);
    return NextResponse.json({ format: "unknown", error: "parse_failed" });
  }
}

// ─── Session-grid: cells like "Kate9/11", "Lulu3/u", "Philip" ────────────────
// Aggregates all entries per client and returns final client state.

async function handleSessionGrid(cells: string[]): Promise<NextResponse> {
  const entryList = cells.join("\n");
  console.log("[parse-spreadsheet] session-grid entries:\n", entryList.slice(0, 600));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are extracting client package status from a personal trainer's attendance log.

Each line is one cell from a spreadsheet. Each cell is an attendance entry for one client.

ENTRY FORMAT:
- "Kate9/11"    → Kate attended session 9 of an 11-session package
- "Viola10/10"  → Viola attended session 10 of a 10-session package
- "Lulu3/u"     → Lulu has attended 3 unpaid sessions (no package)
- "Dasha 2/u"   → Dasha has attended 2 unpaid sessions
- "Philip"      → Philip attended (unpaid, no package, count each appearance)

AGGREGATION RULES (group all entries by client name, case-insensitive):
- Packaged clients (X/number):
  totalSessionsPurchased = the package size (the number after /)
  sessionsRemaining = packageSize − highest session number seen
- Unpaid clients (X/u):
  unpaidSessions = highest number seen across all their entries
- Name-only entries (e.g. "Philip"):
  unpaidSessions = count of how many times this name appears
- Clean names: strip trailing digits, slashes, "u", extra spaces, encoding artifacts

Return ONLY valid JSON:
{
  "clients": [
    {
      "name": "string",
      "totalSessionsPurchased": 0,
      "sessionsRemaining": 0,
      "unpaidSessions": 0
    }
  ]
}`,
        },
        { role: "user", content: entryList },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"clients":[]}';
    console.log("[parse-spreadsheet] AI response:", raw.slice(0, 800));

    const parsed = JSON.parse(raw) as { clients: { name: string; totalSessionsPurchased: number; sessionsRemaining: number; unpaidSessions: number }[] };

    const clients = (Array.isArray(parsed.clients) ? parsed.clients : [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name.trim(),
        totalSessionsPurchased: Math.max(0, Number(c.totalSessionsPurchased) || 0),
        sessionsRemaining: Math.max(0, Number(c.sessionsRemaining) || 0),
        unpaidSessions: Math.max(0, Number(c.unpaidSessions) || 0),
      }));

    return NextResponse.json({ format: "client-roster", clients });
  } catch (err) {
    console.error("[parse-spreadsheet] Groq error:", err);
    return NextResponse.json({ format: "unknown", error: "parse_failed" });
  }
}

// ─── Standard roster: rows with name/sessions columns ────────────────────────

async function handleRosterFormat(cells: string[]): Promise<NextResponse> {
  const entryList = cells.join("\n");
  console.log("[parse-spreadsheet] roster entries:\n", entryList.slice(0, 600));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are extracting client data from a personal trainer's client roster spreadsheet.
Each row represents one client with columns for name, sessions purchased, sessions remaining, and unpaid sessions.
Return ONLY valid JSON:
{
  "clients": [
    {
      "name": "string",
      "totalSessionsPurchased": 0,
      "sessionsRemaining": 0,
      "unpaidSessions": 0
    }
  ]
}`,
        },
        { role: "user", content: entryList },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"clients":[]}';
    const parsed = JSON.parse(raw) as { clients: { name: string; totalSessionsPurchased: number; sessionsRemaining: number; unpaidSessions: number }[] };

    const clients = (Array.isArray(parsed.clients) ? parsed.clients : [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name.trim(),
        totalSessionsPurchased: Math.max(0, Number(c.totalSessionsPurchased) || 0),
        sessionsRemaining: Math.max(0, Number(c.sessionsRemaining) || 0),
        unpaidSessions: Math.max(0, Number(c.unpaidSessions) || 0),
      }));

    return NextResponse.json({ format: "client-roster", clients });
  } catch (err) {
    console.error("[parse-spreadsheet] Groq error:", err);
    return NextResponse.json({ format: "unknown", error: "parse_failed" });
  }
}
