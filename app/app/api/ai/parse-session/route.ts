export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import { aiParseLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { limited } = await checkRateLimit(aiParseLimiter, `ai-parse:${session.user.id}`);
  if (limited) return new NextResponse("Too many requests", { status: 429 });

  const { text: rawText } = await req.json();
  const text = String(rawText ?? "").slice(0, 5000);
  if (!text?.trim()) {
    return NextResponse.json({ clients: [] });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a session parser for a personal training app. Extract the names of clients who were trained from the coach's message. Return ONLY a JSON object with a "clients" array of name strings. If no names are found, return {"clients": []}. Do not include titles (Mr, Ms, etc). Preserve original capitalisation.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{"clients":[]}';
    const parsed = JSON.parse(raw) as { clients: string[] };

    return NextResponse.json({
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
    });
  } catch (err) {
    console.error("[parse-session] Groq error:", err);
    return NextResponse.json({ clients: [], error: "parse_failed" });
  }
}
