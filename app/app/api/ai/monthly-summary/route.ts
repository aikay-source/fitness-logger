export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import { aiParseLimiter, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { limited } = await checkRateLimit(aiParseLimiter, `ai-parse:${session.user.id}`);
  if (limited) return new NextResponse("Too many requests", { status: 429 });

  const { year, month } = (await req.json()) as { year: number; month: number };
  const coachId = session.user.id;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const sessions = await prisma.session.findMany({
    where: { coachId, date: { gte: start, lt: end } },
    include: { client: { select: { name: true } } },
  });

  const totalSessions = sessions.length;

  // Check cache — only regenerate if session count changed
  const cached = await prisma.monthlySummaryCache.findUnique({
    where: { userId_year_month: { userId: coachId, year, month } },
  });

  if (cached && cached.sessionCount === totalSessions) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  if (totalSessions === 0) {
    return NextResponse.json({ summary: null });
  }

  // Build context for Groq
  const clientCounts = new Map<string, number>();
  for (const s of sessions) {
    clientCounts.set(s.client.name, (clientCounts.get(s.client.name) ?? 0) + 1);
  }

  const clientBreakdown = [...clientCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count} session${count !== 1 ? "s" : ""})`)
    .join(", ");

  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a warm, encouraging assistant helping a personal training coach reflect on their month. Write a short 3–4 sentence summary in second person (\"you\"). Be specific, positive, and conversational. No bullet points.",
        },
        {
          role: "user",
          content: `Here is my training data for ${monthName}: I logged ${totalSessions} session${totalSessions !== 1 ? "s" : ""} with these clients: ${clientBreakdown}. Write my monthly summary.`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content ?? null;

    // Cache the result
    await prisma.monthlySummaryCache.upsert({
      where: { userId_year_month: { userId: coachId, year, month } },
      create: { userId: coachId, year, month, summary: summary ?? "", sessionCount: totalSessions },
      update: { summary: summary ?? "", sessionCount: totalSessions },
    });

    return NextResponse.json({ summary, cached: false });
  } catch {
    return NextResponse.json({ summary: null, error: "generation_failed" });
  }
}
