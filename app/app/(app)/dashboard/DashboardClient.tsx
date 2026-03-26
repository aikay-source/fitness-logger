"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, CheckCircle2, AlertTriangle, MessageCircle } from "lucide-react";
import confetti from "canvas-confetti";
import type { ChatResponse } from "@/app/api/ai/chat/route";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; response: ChatResponse };

function buildSuggestions(names: string[]): string[] {
  if (names.length === 0) {
    return [
      "Trained John today",
      "How many sessions this month?",
      "Log a session for Sarah",
    ];
  }
  const a = names[0];
  const b = names.length > 1 ? names[1] : null;
  return [
    `Trained ${a} today`,
    `How many sessions did ${a} have this month?`,
    b ? `${a} and ${b} session today` : `Log a session for ${a}`,
  ];
}

export default function DashboardClient({ clientNames = [] }: { clientNames?: string[] }) {
  const suggestions = buildSuggestions(clientNames);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function getResponseText(r: ChatResponse): string {
    if (r.type === "logged") return r.summary;
    if (r.type === "query_result") return r.answer;
    if (r.type === "no_match") return r.message;
    return r.message;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const newUserMsg: Message = { role: "user", text: trimmed };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Build history from existing messages for the API
    const history = updatedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      text: m.role === "user" ? m.text : getResponseText(m.response),
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: history.slice(0, -1) }),
      });
      const data = (await res.json()) as ChatResponse;
      setMessages((prev) => [...prev, { role: "assistant", response: data }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", response: { type: "error", message: "Network error. Please try again." } },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f] text-wrap-balance">
        Quick log
      </h2>

      <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] overflow-hidden">
        {/* Message history */}
        {messages.length > 0 && (
          <div ref={chatContainerRef} className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                >
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <p className="max-w-[80%] rounded-lg rounded-br-sm bg-[#f2f1ed] px-3 py-2 text-sm text-[#141413]">
                        {msg.text}
                      </p>
                    </div>
                  ) : (
                    <AssistantBubble response={msg.response} />
                  )}
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-[#5e5e5c]"
                >
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-xs">Thinking…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Suggestions + capability hint — shown only when no messages */}
        {messages.length === 0 && (
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-[#3d3d3c] px-3 py-2.5 font-mono text-xs text-[#5e5e5c] hover:border-[#5e5e5c] hover:text-[#a3a29f] active:scale-[0.96] transition-[border-color,color,transform]"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#5e5e5c] text-pretty">
              Log sessions, ask about client history, or check stats.
            </p>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-[#3d3d3c] px-3 py-2.5">
          <MessageCircle size={14} className="text-[#5e5e5c] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Trained anyone today?"
            maxLength={200}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-[#f2f1ed] placeholder-[#5e5e5c] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="relative shrink-0 rounded-lg p-2.5 text-[#5e5e5c] hover:text-[#a3a29f] active:scale-[0.96] disabled:opacity-30 transition-[color,transform] before:absolute before:inset-[-4px] before:content-['']"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </section>
  );
}

function AssistantBubble({ response }: { response: ChatResponse }) {
  useEffect(() => {
    if (response.type === "logged") {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.6 },
        colors: ["#f2f1ed", "#a3a29f", "#3d3d3c"],
        disableForReducedMotion: true,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (response.type === "logged") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-[#f2f1ed]">{response.summary}</p>
        </div>
        {response.details.completedPackages.length > 0 && (
          <p className="ml-5 font-mono text-xs text-amber-400">
            Package complete: {response.details.completedPackages.join(", ")}
          </p>
        )}
        {response.details.lowSessions.length > 0 && (
          <p className="ml-5 font-mono text-xs text-amber-400/70">
            Running low: {response.details.lowSessions.join(", ")}
          </p>
        )}
        {response.details.unpaidAdded.length > 0 && (
          <p className="ml-5 font-mono text-xs text-orange-400">
            Unpaid added: {response.details.unpaidAdded.join(", ")}
          </p>
        )}
      </div>
    );
  }

  if (response.type === "query_result") {
    return (
      <div className="flex items-start gap-2">
        <div className="mt-0.5 size-3.5 shrink-0 rounded-full bg-[#3d3d3c]" />
        <p className="text-sm text-[#f2f1ed]">{response.answer}</p>
      </div>
    );
  }

  if (response.type === "no_match") {
    return (
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-[#a3a29f]">{response.message}</p>
      </div>
    );
  }

  // error
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-[#a3a29f]">{response.message}</p>
    </div>
  );
}
