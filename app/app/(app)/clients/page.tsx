import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DeleteAllButton from "./DeleteAllButton";
import AddClientsModal from "./AddClientsModal";
import ClientListFilter from "./ClientListFilter";

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
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[#f2f1ed] text-wrap-balance">
            Clients
          </h1>
        </div>
        <AddClientsModal existingNames={clients.map((c) => c.name)} />
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-10 text-center">
          <p className="text-sm text-[#a3a29f]">No clients yet.</p>
          <AddClientsModal existingNames={[]} triggerVariant="empty-state" />
        </div>
      )}

      {/* Client list */}
      {clients.length > 0 && (
        <>
          <ClientListFilter
            clients={clients.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              sessionsRemaining: c.sessionsRemaining,
              unpaidSessions: c.unpaidSessions,
            }))}
          />

          {/* Delete all — separated from primary actions */}
          <div className="flex justify-center">
            <DeleteAllButton count={clients.length} />
          </div>
        </>
      )}
    </div>
  );
}
