"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { staggerContainer, staggerItem } from "@/lib/motion.config";

type ClientItem = {
  id: string;
  name: string;
  phone: string | null;
  sessionsRemaining: number;
  unpaidSessions: number;
};

function sessionBadgeClass(remaining: number) {
  if (remaining <= 2) return "bg-red-500/15 text-red-400";
  if (remaining <= 5) return "bg-amber-500/15 text-amber-400";
  return "bg-[var(--app-elevated)] text-[var(--app-tertiary)]";
}

function initials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export default function ClientListFilter({ clients }: { clients: ClientItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]"
    >
      {clients.length > 8 && (
        <div className="px-4 py-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            aria-label="Filter clients by name"
            className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--app-muted)] focus:outline-none"
          />
        </div>
      )}
      {filtered.map((client) => (
        <motion.div key={client.id} variants={staggerItem}>
        <Link
          href={`/clients/${client.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-elevated)] active:scale-[0.98] transition-[background-color,transform] first:rounded-t-xl last:rounded-b-xl"
        >
          <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-border)] font-mono text-xs font-semibold text-[var(--app-text)]">
            {initials(client.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--app-text)]">
              {client.name}
            </p>
            {client.phone && (
              <p className="truncate font-mono text-xs text-[var(--app-muted)]">
                {client.phone}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {client.unpaidSessions > 0 && (
              <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-orange-400">
                {client.unpaidSessions} unpaid
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${sessionBadgeClass(client.sessionsRemaining)}`}
            >
              {client.sessionsRemaining}
            </span>
          </div>
        </Link>
        </motion.div>
      ))}
      {search && filtered.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-[var(--app-muted)]">No clients match &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </motion.div>
  );
}
