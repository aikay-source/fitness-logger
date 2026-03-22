import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

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
  | { format: "unknown"; error: string };

// Matches cells like "Kate9/11", "Lulu3/u", "Dasha 2/u", "Philip"
// i.e. a name followed by an optional X/Y or X/u session marker
const SESSION_GRID_CELL = /^[a-zA-ZÀ-ÿ][\w\s'-]*\s*(\d+\s*\/\s*(\d+|u))?$/i;
const HEADER_PATTERN = /^(names?\s+of|session\s+count|total\s+sessions|date|month|week|facility|charge)/i;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { rawData } = (await req.json()) as { rawData: string[][] };

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return NextResponse.json({ format: "unknown", error: "No data provided" });
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

// ─── Session-grid: cells like "Kate9/11", "Lulu3/u", "Philip" ────────────────
// Aggregates all entries per client and returns final client state.

async function handleSessionGrid(cells: string[]): Promise<NextResponse> {
  const entryList = cells.join("\n");
  console.log("[parse-spreadsheet] session-grid entries:\n", entryList.slice(0, 600));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
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
