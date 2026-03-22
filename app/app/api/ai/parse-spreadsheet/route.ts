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

  // Flatten the 2D grid into a single list of non-empty cell values.
  // This is critical for date-log grids where each CELL is a client entry,
  // not each row. Skip obvious header/summary cells.
  const HEADER_PATTERN = /^(names?\s+of|session\s+count|total\s+sessions|date|month|week|facility|charge)/i;

  const entries = rawData
    .flat()
    .map((cell) => String(cell ?? "").trim())
    .filter((cell) => cell.length > 0 && !HEADER_PATTERN.test(cell));

  if (entries.length === 0) {
    return NextResponse.json({ clients: [], error: "No client entries found" });
  }

  const entryList = entries.join("\n");
  console.log("[parse-spreadsheet] entries sent to AI:\n", entryList.slice(0, 600));

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are extracting client session data from a personal trainer's attendance log.

Each line you receive is one cell from a spreadsheet. Each cell is an independent client attendance entry.

ENTRY FORMAT RULES:
- "Kate9/11"    → Kate is on session 9 of an 11-session package. totalSessionsPurchased=11, sessionsRemaining=11-9=2
- "Viola10/10"  → Viola completed session 10 of 10. sessionsRemaining=0
- "Lulu3/u"     → Lulu has done 3 unpaid sessions. unpaidSessions=3, totalSessionsPurchased=0
- "Dasha 2/u"   → Dasha has done 2 unpaid sessions. unpaidSessions=2
- "Philip"      → Philip attended with no tracking. Count each appearance as 1 unpaid session.

HOW TO AGGREGATE:
- Group all entries by client name (case-insensitive, ignore extra spaces).
- For packaged clients (X/number): use the HIGHEST session number seen across all entries.
  sessionsRemaining = packageSize - highestSessionNumber
- For unpaid clients (X/u): use the HIGHEST number seen as unpaidSessions.
- For name-only entries like "Philip": unpaidSessions = number of times the name appears.
- Clean names: strip trailing digits, slashes, "u", extra spaces, and encoding artifacts.
- Do NOT include header rows or summary entries as clients.

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
        {
          role: "user",
          content: entryList,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"clients":[]}';
    console.log("[parse-spreadsheet] AI response:", raw.slice(0, 1000));
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
