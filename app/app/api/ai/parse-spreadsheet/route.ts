import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

type ParsedClient = {
  name: string;
  totalSessionsPurchased: number;
  sessionsRemaining: number;
  unpaidSessions: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { rawData } = (await req.json()) as { rawData: string[][] };

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return NextResponse.json({ clients: [], error: "No data provided" });
  }

  // Convert 2D array to a readable text table for the AI
  const tableText = rawData
    .map((row) => row.map((cell) => String(cell ?? "")).join(" | "))
    .filter((row) => row.replace(/\|/g, "").trim())
    .slice(0, 300) // cap at 300 rows to stay within token limits
    .join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a fitness/personal training data extractor. Your job is to extract client session data from ANY spreadsheet format a fitness coach might use.

The spreadsheet could be structured in many ways:
1. A standard table where each ROW is a client, with columns like Name, Sessions Purchased, Sessions Remaining, Unpaid, etc.
2. A DATE-LOG GRID where each ROW is a date and each CELL contains a client entry for that day.
3. Any other custom format.

DATE-LOG FORMAT (very common):
Cells encode data as "ClientNameN/Total" or "ClientName N/u":
- "Kate9/11"    → Kate is on session 9 of an 11-session package. Sessions remaining = 11 - 9 = 2.
- "Viola10/10"  → Viola completed her 10-session package. Sessions remaining = 0.
- "Lulu3/u"     → Lulu attended 3 sessions with NO package (unpaid, pay-as-you-go). unpaidSessions = 3.
- "Chantalle4/u"→ Chantalle attended 4 unpaid sessions.
- "Philip"      → Philip attended but has no tracking info (treat as 1 unpaid session per appearance).

Rules for date-log format:
- Each unique client name may appear across MULTIPLE rows (dates). Count each appearance as one session attended.
- For packaged clients (X/number): use the HIGHEST session number seen to get their current position.
  sessionsRemaining = packageSize - highestSessionNumber
- For unpaid clients (X/u): unpaidSessions = total number of times they appear. totalSessionsPurchased = 0.
- Clean names: strip numbers, slashes, "u", trailing spaces, encoding artifacts (like Â, Â·, etc.).
- Do NOT include "Total Sessions Held", "Facility Charge", or other summary rows as clients.

Return ONLY valid JSON in this exact format — no extra text:
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
        {
          role: "user",
          content: tableText,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"clients":[]}';
    const parsed = JSON.parse(raw) as { clients: ParsedClient[] };

    const clients = (Array.isArray(parsed.clients) ? parsed.clients : [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name.trim(),
        totalSessionsPurchased: Math.max(0, Number(c.totalSessionsPurchased) || 0),
        sessionsRemaining: Math.max(0, Number(c.sessionsRemaining) || 0),
        unpaidSessions: Math.max(0, Number(c.unpaidSessions) || 0),
      }));

    return NextResponse.json({ clients });
  } catch (err) {
    console.error("[parse-spreadsheet] Groq error:", err);
    return NextResponse.json({ clients: [], error: "parse_failed" });
  }
}
