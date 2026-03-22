"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type LogSessionResult = {
  success: boolean;
  sessionCount: number;
  completedPackages: string[]; // client names whose sessionsRemaining hit 0
  lowSessions: string[];       // client names now at ≤ 2 (but > 0)
  unpaidAdded: string[];       // client names logged against a zero balance
  error?: string;
};

export async function logSession(
  clientIds: string[],
  date: Date,
  notes?: string
): Promise<LogSessionResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { success: false, sessionCount: 0, completedPackages: [], lowSessions: [], unpaidAdded: [], error: "Unauthorized" };
  }

  const coachId = session.user.id;

  if (clientIds.length === 0) {
    return { success: false, sessionCount: 0, completedPackages: [], lowSessions: [], unpaidAdded: [], error: "No clients selected" };
  }

  // Verify all clients belong to this coach
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, coachId },
    select: { id: true, name: true, sessionsRemaining: true },
  });

  if (clients.length !== clientIds.length) {
    return { success: false, sessionCount: 0, completedPackages: [], lowSessions: [], unpaidAdded: [], error: "Invalid client IDs" };
  }

  // Split clients: those with remaining sessions vs those on zero balance
  const withBalance = clients.filter((c) => c.sessionsRemaining > 0);
  const withoutBalance = clients.filter((c) => c.sessionsRemaining === 0);

  // Transactional: insert sessions + update counts
  await prisma.$transaction(async (tx) => {
    await tx.session.createMany({
      data: clients.map((c) => ({
        clientId: c.id,
        coachId,
        date,
        notes: notes?.trim() || null,
        rawInput: notes?.trim() || null,
      })),
    });

    // Decrement remaining for clients who have sessions
    for (const client of withBalance) {
      await tx.client.update({
        where: { id: client.id },
        data: { sessionsRemaining: client.sessionsRemaining - 1 },
      });
    }

    // Increment unpaid for clients on zero balance
    for (const client of withoutBalance) {
      await tx.client.update({
        where: { id: client.id },
        data: { unpaidSessions: { increment: 1 } },
      });
    }
  });

  // Post-update alerts
  const updated = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { name: true, sessionsRemaining: true },
  });

  const completedPackages = updated
    .filter((c) => c.sessionsRemaining === 0 && withBalance.some((w) => w.name === c.name))
    .map((c) => c.name);

  const lowSessions = updated
    .filter((c) => c.sessionsRemaining > 0 && c.sessionsRemaining <= 2)
    .map((c) => c.name);

  const unpaidAdded = withoutBalance.map((c) => c.name);

  revalidatePath("/dashboard");
  revalidatePath("/clients");

  return {
    success: true,
    sessionCount: clients.length,
    completedPackages,
    lowSessions,
    unpaidAdded,
  };
}
