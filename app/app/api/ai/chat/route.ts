export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import { matchNames } from "@/lib/fuzzy-match";
import { logSession } from "@/app/actions/sessions";

// ── Types ──────────────────────────────────────────────────────────────────────

type HistoryMessage = { role: "user"; text: string } | { role: "assistant"; text: string };

type ChatIntent =
  | { type: "log"; names: string[]; date: string }
  | { type: "query_month"; name: string; year: number; month: number }
  | { type: "query_total"; name: string }
  | { type: "query_last_session"; name: string }
  | { type: "conversational"; message: string }
  | { type: "unknown"; message: string };

export type ChatResponse =
  | { type: "logged"; summary: string; details: { completedPackages: string[]; lowSessions: string[]; unpaidAdded: string[] } }
  | { type: "query_result"; answer: string }
  | { type: "no_match"; message: string }
  | { type: "error"; message: string };

// ── Intent classification ──────────────────────────────────────────────────────

function buildHistoryContext(history: HistoryMessage[]): string {
  if (history.length === 0) return "";
  const recent = history.slice(-10); // last 10 messages for context
  const lines = recent.map((m) =>
    m.role === "user" ? `User: ${m.text}` : `Assistant: ${m.text}`
  );
  return `\nConversation so far:\n${lines.join("\n")}\n`;
}

async function classifyIntent(message: string, today: string, history: HistoryMessage[]): Promise<ChatIntent> {
  const historyContext = buildHistoryContext(history);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify a personal trainer's message into one of these intents.
Today is ${today}.
${historyContext}
Return ONLY valid JSON matching one of:

1. Logging a session:
{"type":"log","names":["Name1","Name2"],"date":"YYYY-MM-DD"}
- "trained Kate and Tom today" → names:["Kate","Tom"], date:today
- "Kate session yesterday" → names:["Kate"], date:yesterday

2. Querying a specific month:
{"type":"query_month","name":"ClientName","year":2024,"month":3}
- "how many sessions did Kate have in March?" → month:3, year:current year
- "Kate's sessions in September 2024" → month:9, year:2024

3. Querying total sessions:
{"type":"query_total","name":"ClientName"}
- "how many sessions has Kate had total?" or "Kate's total sessions"

4. Querying last session date:
{"type":"query_last_session","name":"ClientName"}
- "when was Kate's last session?" or "when did Dasha last train?" or "last session for Kate"

5. Conversational follow-up (references previous messages, asks follow-ups, uses pronouns like "she/he/they", or discusses previous answers):
{"type":"conversational","message":"the user's resolved question with full context"}
- "I thought you said she didn't have a session" → conversational, with resolved context
- "what about last month?" → conversational, referencing previous client/topic
- "are you sure?" → conversational
- "why?" or "tell me more" → conversational

6. Unknown (only if truly unrelated to training/sessions and no conversation context helps):
{"type":"unknown","message":"brief explanation of why"}

Rules:
- USE CONVERSATION HISTORY to resolve pronouns: "she"/"he"/"they"/"her"/"him" → the client mentioned most recently
- USE CONVERSATION HISTORY to resolve references: "that month", "last month", "what about X" → resolve from context
- Dates: "today"=today, "yesterday"=yesterday, month names use current year unless specified
- Extract clean client names (no extra words)
- If multiple names for logging, include all in names array
- Prefer log intent for statements like "trained X", "session with X", "X today"
- If the message references or follows up on a previous answer, use "conversational"
- Only use "unknown" as a last resort when the message has no relation to training at all`,
      },
      { role: "user", content: message },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{"type":"unknown","message":"parse failed"}';
  try {
    return JSON.parse(raw) as ChatIntent;
  } catch {
    return { type: "unknown", message: "Could not parse intent" };
  }
}

// ── Conversational reply generator ────────────────────────────────────────────

async function generateReply(
  dataContext: string,
  today: string,
  history: HistoryMessage[],
  userMessage: string,
): Promise<string> {
  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `You are a friendly, conversational assistant for a personal trainer. You help them keep track of their clients' sessions.

Today is ${today}.

Here is the real data from the database:
${dataContext}

Rules:
- Be warm and natural, like a helpful colleague — not robotic or template-y
- Keep it concise, 1-3 sentences
- Always mention the key numbers: sessions bought, used, remaining, and unpaid (if any)
- Never use emojis
- Only reference data provided above, never make anything up
- If something looks off in the data, mention it naturally`,
    },
  ];

  for (const m of history.slice(-10)) {
    chatMessages.push({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    });
  }
  chatMessages.push({ role: "user", content: userMessage });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.4,
    max_tokens: 250,
    messages: chatMessages,
  });

  return completion.choices[0]?.message?.content ?? "Sorry, I couldn't pull that together. Try asking again.";
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const coachId = session.user.id;
  const { message, history = [] } = (await req.json()) as {
    message: string;
    history?: HistoryMessage[];
  };

  if (!message?.trim()) {
    return NextResponse.json<ChatResponse>({ type: "error", message: "Empty message" });
  }

  // Get today in YYYY-MM-DD
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Load client roster for fuzzy matching
  const roster = await prisma.client.findMany({
    where: { coachId },
    select: { id: true, name: true },
  });

  let intent: ChatIntent;
  try {
    intent = await classifyIntent(message.trim(), today, history);
  } catch (err) {
    console.error("[chat] Groq error:", err);
    return NextResponse.json<ChatResponse>({ type: "error", message: "AI unavailable. Please try again." });
  }

  // ── Log intent ──────────────────────────────────────────────────────────────
  if (intent.type === "log") {
    const matches = matchNames(intent.names, roster);
    const unmatched = matches.filter((m) => !m.matched).map((m) => (!m.matched ? m.input : ""));

    if (unmatched.length > 0) {
      return NextResponse.json<ChatResponse>({
        type: "no_match",
        message: `Hmm, I couldn't find ${unmatched.join(", ")} in your client list. Could you double-check the spelling or add them first?`,
      });
    }

    const clientIds = matches.map((m) => (m.matched ? m.client.id : ""));
    const sessionDate = new Date(intent.date + "T12:00:00");

    const result = await logSession(clientIds, sessionDate);

    if (!result.success) {
      return NextResponse.json<ChatResponse>({ type: "error", message: result.error ?? "Failed to log sessions." });
    }

    const names = matches.map((m) => (m.matched ? m.client.name : "")).join(", ");
    const dateLabel =
      intent.date === today
        ? "today"
        : new Date(intent.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return NextResponse.json<ChatResponse>({
      type: "logged",
      summary: `Done, logged ${result.sessionCount} session${result.sessionCount !== 1 ? "s" : ""} for ${names} on ${dateLabel}.`,
      details: {
        completedPackages: result.completedPackages,
        lowSessions: result.lowSessions,
        unpaidAdded: result.unpaidAdded,
      },
    });
  }

  // ── Query month intent ──────────────────────────────────────────────────────
  if (intent.type === "query_month") {
    const [match] = matchNames([intent.name], roster);
    if (!match.matched) {
      return NextResponse.json<ChatResponse>({
        type: "no_match",
        message: `I couldn't find anyone named "${intent.name}" in your roster. Could you check the spelling or add them first?`,
      });
    }

    const startOfMonth = new Date(intent.year, intent.month - 1, 1);
    const endOfMonth = new Date(intent.year, intent.month, 0, 23, 59, 59);

    const [count, client] = await Promise.all([
      prisma.session.count({
        where: {
          clientId: match.client.id,
          coachId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.client.findFirst({
        where: { id: match.client.id, coachId },
        select: { totalSessionsPurchased: true, sessionsRemaining: true, unpaidSessions: true },
      }),
    ]);

    const monthLabel = new Date(intent.year, intent.month - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    const bought = client?.totalSessionsPurchased ?? 0;
    const remaining = client?.sessionsRemaining ?? 0;
    const used = Math.max(0, bought - remaining);
    const unpaid = client?.unpaidSessions ?? 0;

    const answer = await generateReply(
      `The user asked about ${match.client.name}'s sessions in ${monthLabel}.\nData: ${count} sessions that month. Sessions bought: ${bought}, used: ${used}, remaining: ${remaining}, unpaid: ${unpaid}.`,
      today, history, message,
    );

    return NextResponse.json<ChatResponse>({ type: "query_result", answer });
  }

  // ── Query total intent ──────────────────────────────────────────────────────
  if (intent.type === "query_total") {
    const [match] = matchNames([intent.name], roster);
    if (!match.matched) {
      return NextResponse.json<ChatResponse>({
        type: "no_match",
        message: `I couldn't find anyone named "${intent.name}" in your roster. Could you check the spelling or add them first?`,
      });
    }

    const [count, client] = await Promise.all([
      prisma.session.count({
        where: { clientId: match.client.id, coachId },
      }),
      prisma.client.findFirst({
        where: { id: match.client.id, coachId },
        select: { totalSessionsPurchased: true, sessionsRemaining: true, unpaidSessions: true },
      }),
    ]);

    const bought = client?.totalSessionsPurchased ?? 0;
    const remaining = client?.sessionsRemaining ?? 0;
    const used = Math.max(0, bought - remaining);
    const unpaid = client?.unpaidSessions ?? 0;

    const answer = await generateReply(
      `The user asked about ${match.client.name}'s total session count.\nData: ${count} sessions total. Sessions bought: ${bought}, used: ${used}, remaining: ${remaining}, unpaid: ${unpaid}.`,
      today, history, message,
    );

    return NextResponse.json<ChatResponse>({ type: "query_result", answer });
  }

  // ── Query last session intent ──────────────────────────────────────────────
  if (intent.type === "query_last_session") {
    const [match] = matchNames([intent.name], roster);
    if (!match.matched) {
      return NextResponse.json<ChatResponse>({
        type: "no_match",
        message: `I couldn't find anyone named "${intent.name}" in your roster. Could you check the spelling or add them first?`,
      });
    }

    const [lastSession, client] = await Promise.all([
      prisma.session.findFirst({
        where: { clientId: match.client.id, coachId },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      prisma.client.findFirst({
        where: { id: match.client.id, coachId },
        select: { totalSessionsPurchased: true, sessionsRemaining: true, unpaidSessions: true },
      }),
    ]);

    const bought = client?.totalSessionsPurchased ?? 0;
    const remaining = client?.sessionsRemaining ?? 0;
    const used = Math.max(0, bought - remaining);
    const unpaid = client?.unpaidSessions ?? 0;

    let dataContext: string;
    if (!lastSession) {
      dataContext = `The user asked about ${match.client.name}'s last session.\nData: No sessions logged yet. Sessions bought: ${bought}, used: ${used}, remaining: ${remaining}, unpaid: ${unpaid}.`;
    } else {
      const dateLabel = new Date(lastSession.date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      dataContext = `The user asked about ${match.client.name}'s last session.\nData: Last session was on ${dateLabel}. Sessions bought: ${bought}, used: ${used}, remaining: ${remaining}, unpaid: ${unpaid}.`;
    }

    const answer = await generateReply(dataContext, today, history, message);
    return NextResponse.json<ChatResponse>({ type: "query_result", answer });
  }

  // ── Conversational follow-up ────────────────────────────────────────────────
  if (intent.type === "conversational") {
    // Gather data context: try to find the client mentioned in recent history
    const allNames = roster.map((r) => r.name);
    const historyText = history.map((m) => m.text).join(" ");
    const referencedClients = roster.filter(
      (r) => historyText.toLowerCase().includes(r.name.toLowerCase()) ||
             message.toLowerCase().includes(r.name.toLowerCase())
    );

    let dataContext = "";
    for (const client of referencedClients.slice(0, 3)) {
      const [totalCount, recentSessions, clientData] = await Promise.all([
        prisma.session.count({ where: { clientId: client.id, coachId } }),
        prisma.session.findMany({
          where: { clientId: client.id, coachId },
          orderBy: { date: "desc" },
          take: 20,
          select: { date: true, paid: true, sessionNumber: true, packageSize: true },
        }),
        prisma.client.findFirst({
          where: { id: client.id, coachId },
          select: { totalSessionsPurchased: true, sessionsRemaining: true, unpaidSessions: true },
        }),
      ]);

      const sessionDates = recentSessions.map((s) => {
        const d = new Date(s.date);
        return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${s.paid ? "" : " (unpaid)"}`;
      });

      const bought = clientData?.totalSessionsPurchased ?? 0;
      const remaining = clientData?.sessionsRemaining ?? 0;
      const unpaid = clientData?.unpaidSessions ?? 0;

      dataContext += `\nClient "${client.name}": ${totalCount} total sessions. Package: ${bought} bought, ${remaining} remaining, ${unpaid} unpaid.`;
      dataContext += `\nRecent sessions: ${sessionDates.length > 0 ? sessionDates.join(", ") : "none logged"}.`;

      // Add per-month breakdown for the last 3 months
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const monthCount = recentSessions.filter(
          (s) => new Date(s.date) >= monthStart && new Date(s.date) <= monthEnd
        ).length;
        const monthLabel = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        dataContext += `\n  ${monthLabel}: ${monthCount} session${monthCount !== 1 ? "s" : ""}`;
      }
    }

    if (!dataContext && referencedClients.length === 0) {
      dataContext = "\nNo specific client could be identified from the conversation.";
      dataContext += `\nAvailable clients: ${allNames.join(", ")}`;
    }

    try {
      const answer = await generateReply(dataContext, today, history, message);
      return NextResponse.json<ChatResponse>({ type: "query_result", answer });
    } catch {
      return NextResponse.json<ChatResponse>({
        type: "error",
        message: "AI unavailable. Please try again.",
      });
    }
  }

  // ── Unknown / general intent — respond conversationally ─────────────────────
  try {
    const answer = await generateReply(
      `Available clients: ${roster.map((r) => r.name).join(", ") || "none yet"}.\nThe user's message doesn't map to a specific data query. Respond conversationally.`,
      today, history, message,
    );
    return NextResponse.json<ChatResponse>({ type: "query_result", answer });
  } catch {
    return NextResponse.json<ChatResponse>({ type: "error", message: "AI unavailable. Please try again." });
  }
}
