import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import DeleteAllButton from "./DeleteAllButton";
import AddClientsModal from "./AddClientsModal";

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
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#f2f1ed] text-wrap-balance">
            Clients
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {clients.length > 0 && <DeleteAllButton count={clients.length} />}
          <AddClientsModal existingNames={clients.map((c) => c.name)} />
        </div>
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="rounded-xl bg-[#1e1e1d] shadow-[0_0_0_1px_rgba(61,61,60,0.5),0_2px_4px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)] p-10 text-center">
          <p className="text-sm text-[#a3a29f]">No clients yet.</p>
          <AddClientsModal existingNames={[]} triggerVariant="empty-state" />
        </div>
      )}

      {/* Client list */}
      {clients.length > 0 && (
        <div className="divide-y divide-[#3d3d3c] rounded-xl bg-[#1e1e1d] shadow-[0_0_0_1px_rgba(61,61,60,0.5),0_2px_4px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)]">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#262625] active:scale-[0.99] transition-[background-color,transform] first:rounded-t-xl last:rounded-b-xl"
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
          ))}
        </div>
      )}
    </div>
  );
}
