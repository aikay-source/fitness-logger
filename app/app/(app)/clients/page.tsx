import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import DeleteAllButton from "./DeleteAllButton";
import AddClientsModal from "./AddClientsModal";
import ClientListFilter from "./ClientListFilter";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const coachId = session.user.id;

  const clients = await prisma.client.findMany({
    where: { coachId, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            Your roster
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)] text-wrap-balance">
            Clients
          </h1>
        </div>
        <AddClientsModal existingNames={clients.map((c) => c.name)} />
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-12 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--app-elevated)]">
            <Users size={20} className="text-[var(--app-tertiary)]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--app-text)]">No clients yet</p>
            <p className="text-xs text-[var(--app-muted)] text-pretty max-w-xs mx-auto">
              Add clients one by one, or import a spreadsheet if you have an existing roster.
            </p>
          </div>
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
    </main>
  );
}
