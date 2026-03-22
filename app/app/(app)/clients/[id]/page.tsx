import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ClientDetailClient from "./ClientDetailClient";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const coachId = session!.user.id;

  const client = await prisma.client.findFirst({
    where: { id, coachId },
    include: {
      sessions: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Back */}
      <div>
        <Link
          href="/clients"
          className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
        >
          <ChevronLeft size={13} />
          Clients
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#3d3d3c] font-mono text-sm font-semibold text-[#f2f1ed]">
              {client.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[#f2f1ed]">
                {client.name}
              </h1>
              {client.phone && (
                <p className="font-mono text-xs text-[#5e5e5c]">
                  {client.phone}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Package card — editable */}
      <ClientDetailClient
        client={{
          id: client.id,
          name: client.name,
          totalSessionsPurchased: client.totalSessionsPurchased,
          sessionsRemaining: client.sessionsRemaining,
          unpaidSessions: client.unpaidSessions,
        }}
      />

      {/* Session history */}
      <section className="space-y-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
          Session history
        </h2>
        {client.sessions.length === 0 ? (
          <div className="rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] p-6 text-center">
            <p className="text-sm text-[#a3a29f]">No sessions logged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#3d3d3c] rounded-xl border border-[#3d3d3c] bg-[#1e1e1d]">
            {client.sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <p className="text-sm text-[#f2f1ed]">
                  {s.notes || "Session logged"}
                </p>
                <p className="font-mono text-xs text-[#5e5e5c]">
                  {new Date(s.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
