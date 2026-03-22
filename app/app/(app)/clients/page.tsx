import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlusCircle, Upload } from "lucide-react";
import DeleteAllButton from "./DeleteAllButton";

function sessionBadgeClass(remaining: number) {
  if (remaining <= 2) return "bg-red-500/15 text-red-400";
  if (remaining <= 5) return "bg-amber-500/15 text-amber-400";
  return "bg-[#2a2a29] text-[#a3a29f]";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  const coachId = session!.user.id;

  const clients = await prisma.client.findMany({
    where: { coachId, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            Your roster
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#f2f1ed]">
            Clients
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {clients.length > 0 && <DeleteAllButton count={clients.length} />}
          <Link
            href="/clients/import"
            className="flex items-center gap-1.5 rounded-lg border border-[#3d3d3c] px-3 py-2 text-xs font-semibold text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] transition-colors"
          >
            <Upload size={13} />
            Import
          </Link>
          <Link
            href="/clients/new"
            className="flex items-center gap-1.5 rounded-lg bg-[#f2f1ed] px-3 py-2 text-xs font-semibold text-[#141413] hover:bg-white transition-colors"
          >
            <PlusCircle size={13} />
            Add
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-10 text-center">
          <p className="text-sm text-[#a3a29f]">No clients yet.</p>
          <Link
            href="/clients/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#f2f1ed] px-4 py-2 text-sm font-semibold text-[#141413] hover:bg-white transition-colors"
          >
            <PlusCircle size={14} />
            Add your first client
          </Link>
        </div>
      )}

      {/* Client list */}
      {clients.length > 0 && (
        <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#262625] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              {/* Avatar */}
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3d3d3c] font-mono text-xs font-semibold text-[#f2f1ed]">
                {initials(client.name)}
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#f2f1ed]">
                  {client.name}
                </p>
                {client.phone && (
                  <p className="truncate font-mono text-xs text-[#5e5e5c]">
                    {client.phone}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex shrink-0 items-center gap-1.5">
                {client.unpaidSessions > 0 && (
                  <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-orange-400">
                    {client.unpaidSessions} unpaid
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${sessionBadgeClass(client.sessionsRemaining)}`}
                >
                  {client.sessionsRemaining}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
