export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ParsedSessionEntry } from "@/app/api/ai/parse-spreadsheet/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const coachId = session.user.id;
  const { sessions: entries } = (await req.json()) as {
    sessions: ParsedSessionEntry[];
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return new NextResponse("No sessions provided", { status: 400 });
  }

  // ── 1. Resolve client names → IDs ─────────────────────────────────────────
  const uniqueNames = [...new Set(entries.map((e) => e.name.trim()))];

  // Load existing clients for this coach (case-insensitive match)
  const existingClients = await prisma.client.findMany({
    where: { coachId },
    select: { id: true, name: true },
  });

  const nameToId = new Map<string, string>();

  // Populate map for existing clients
  for (const name of uniqueNames) {
    const match = existingClients.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (match) nameToId.set(name, match.id);
  }

  // Batch-create all new clients in one round trip
  const newNames = uniqueNames.filter((n) => !nameToId.has(n));
  if (newNames.length > 0) {
    const created = await prisma.client.createManyAndReturn({
      data: newNames.map((name) => ({ name, coachId })),
    });
    for (const c of created) nameToId.set(c.name, c.id);
  }

  // ── 2. Group sessions by clientId and sort by date ────────────────────────
  type EnrichedEntry = ParsedSessionEntry & { clientId: string };

  const enriched: EnrichedEntry[] = entries
    .filter((e) => nameToId.has(e.name.trim()))
    .map((e) => ({ ...e, clientId: nameToId.get(e.name.trim())! }));

  const byClient = new Map<string, EnrichedEntry[]>();
  for (const entry of enriched) {
    const list = byClient.get(entry.clientId) ?? [];
    list.push(entry);
    byClient.set(entry.clientId, list);
  }

  // Sort each client's sessions by date ascending
  for (const list of byClient.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── 3. Detect package episodes per client ─────────────────────────────────
  type EpisodeCandidate = {
    clientId: string;
    coachId: string;
    totalSessions: number;
    startDate: Date;
    endDate: Date | null;
    status: string;
    // Entry indices belonging to this episode (in the sorted list)
    entryIndices: number[];
  };

  const allEpisodeCandidates: EpisodeCandidate[] = [];
  // Map from clientId → episode index array parallel to that client's entries
  const clientEpisodeMap = new Map<string, number[]>(); // entryIndex → episodeLocalIndex

  for (const [clientId, clientEntries] of byClient) {
    const episodeIndexPerEntry: number[] = new Array(clientEntries.length).fill(-1);
    const episodes: EpisodeCandidate[] = [];
    let currentEpisodeIdx = -1;
    let prevSessionNumber = 0;
    let prevPackageSize: number | null = null;

    for (let i = 0; i < clientEntries.length; i++) {
      const entry = clientEntries[i];

      // Unpaid / untracked sessions never belong to an episode
      if (!entry.paid || entry.sessionNumber === null) {
        continue;
      }

      const packageChanged =
        entry.packageSize !== null &&
        prevPackageSize !== null &&
        entry.packageSize !== prevPackageSize;

      const sessionReset = entry.sessionNumber <= prevSessionNumber;

      const isNewEpisode =
        currentEpisodeIdx === -1 || sessionReset || packageChanged;

      if (isNewEpisode) {
        // Close the previous episode
        if (currentEpisodeIdx !== -1) {
          const prev = episodes[currentEpisodeIdx];
          // End date is the previous paid entry's date
          const prevPaidIdx = episodeIndexPerEntry.lastIndexOf(
            currentEpisodeIdx,
            i - 1
          );
          if (prevPaidIdx !== -1) {
            prev.endDate = new Date(clientEntries[prevPaidIdx].date);
          }
          prev.status = "completed";
        }

        const newEpisode: EpisodeCandidate = {
          clientId,
          coachId,
          totalSessions: entry.packageSize ?? entry.sessionNumber,
          startDate: new Date(entry.date),
          endDate: null,
          status: "active",
          entryIndices: [],
        };
        episodes.push(newEpisode);
        currentEpisodeIdx = episodes.length - 1;
      }

      episodes[currentEpisodeIdx].entryIndices.push(i);
      episodeIndexPerEntry[i] = currentEpisodeIdx;
      prevSessionNumber = entry.sessionNumber;
      prevPackageSize = entry.packageSize;
    }

    clientEpisodeMap.set(clientId, episodeIndexPerEntry);
    allEpisodeCandidates.push(...episodes);
  }

  // ── 4. Persist episodes (delete old ones for affected clients, recreate) ───
  const affectedClientIds = [...byClient.keys()];

  // Null out packageEpisodeId on existing sessions first to avoid FK constraint
  // violation when we delete the old PackageEpisode rows below.
  await prisma.session.updateMany({
    where: { clientId: { in: affectedClientIds }, coachId },
    data: { packageEpisodeId: null },
  });

  await prisma.packageEpisode.deleteMany({
    where: { clientId: { in: affectedClientIds }, coachId },
  });

  // Create episodes and build a lookup: (clientId, localEpisodeIndex) → episodeId
  const episodeIdLookup = new Map<string, string>(); // key: "clientId:localIdx"

  if (allEpisodeCandidates.length > 0) {
    // Batch-create all episodes in one round trip; order is preserved
    const createdEpisodes = await prisma.packageEpisode.createManyAndReturn({
      data: allEpisodeCandidates.map((ep) => ({
        clientId: ep.clientId,
        coachId: ep.coachId,
        totalSessions: ep.totalSessions,
        startDate: ep.startDate,
        endDate: ep.endDate,
        status: ep.status,
      })),
    });

    const clientEpisodeCounter = new Map<string, number>();
    for (let i = 0; i < allEpisodeCandidates.length; i++) {
      const ep = allEpisodeCandidates[i];
      const localIdx = clientEpisodeCounter.get(ep.clientId) ?? 0;
      clientEpisodeCounter.set(ep.clientId, localIdx + 1);
      episodeIdLookup.set(`${ep.clientId}:${localIdx}`, createdEpisodes[i].id);
    }
  }

  // ── 5. Upsert sessions (overwrite by clientId + dateKey) ──────────────────
  // Run all upserts concurrently — each has unique data (episodeId per row)
  // so createMany can't be used, but parallel execution avoids serial blocking.
  const upsertPromises: Promise<unknown>[] = [];

  for (const [clientId, clientEntries] of byClient) {
    const episodeIndexPerEntry = clientEpisodeMap.get(clientId) ?? [];

    for (let i = 0; i < clientEntries.length; i++) {
      const entry = clientEntries[i];
      const localEpisodeIdx = episodeIndexPerEntry[i];
      const episodeId =
        localEpisodeIdx !== -1
          ? episodeIdLookup.get(`${clientId}:${localEpisodeIdx}`) ?? null
          : null;

      // Parse as noon UTC so the calendar date is stable in any timezone
      const sessionDate = new Date(entry.date + "T12:00:00.000Z");

      upsertPromises.push(
        prisma.session.upsert({
          where: { clientId_dateKey: { clientId, dateKey: entry.date } },
          update: {
            date: sessionDate,
            sessionNumber: entry.sessionNumber,
            packageSize: entry.packageSize,
            paid: entry.paid,
            packageEpisodeId: episodeId,
            // Wipe manual notes/rawInput — import wins
            notes: null,
            rawInput: null,
          },
          create: {
            clientId,
            coachId,
            date: sessionDate,
            dateKey: entry.date,
            sessionNumber: entry.sessionNumber,
            packageSize: entry.packageSize,
            paid: entry.paid,
            packageEpisodeId: episodeId,
          },
        })
      );
    }
  }

  await Promise.all(upsertPromises);
  const importedCount = upsertPromises.length;

  // ── 6. Recalculate and update client flat totals ───────────────────────────
  await Promise.all(affectedClientIds.map(async (clientId) => {
    const clientEntries = byClient.get(clientId)!;

    // Most recent entry for this client (already sorted ascending, take last)
    const latest = clientEntries[clientEntries.length - 1];

    const unpaidCount = clientEntries.filter((e) => !e.paid).length;
    const hasPaidEntry = clientEntries.some((e) => e.paid && e.packageSize);

    let totalSessionsPurchased = 0;
    let sessionsRemaining = 0;
    let unpaidSessions = 0;

    if (hasPaidEntry) {
      // Use the most recent paid entry to derive current status
      const latestPaid = [...clientEntries]
        .reverse()
        .find((e) => e.paid && e.packageSize);

      if (latestPaid) {
        totalSessionsPurchased = latestPaid.packageSize!;
        sessionsRemaining = Math.max(
          0,
          latestPaid.packageSize! - (latestPaid.sessionNumber ?? 0)
        );
      }

      // Unpaid sessions are those without a package and with sessionsRemaining = 0
      if (sessionsRemaining === 0) {
        unpaidSessions = unpaidCount;
      }
    } else {
      // All sessions are unpaid
      unpaidSessions = unpaidCount;
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { totalSessionsPurchased, sessionsRemaining, unpaidSessions },
    });
  }));

  // ── 7. Invalidate monthly summary cache for affected months ───────────────
  const affectedMonths = new Set(
    enriched.map((e) => {
      const [year, month] = e.date.split("-").map(Number);
      return `${year}-${month}`;
    })
  );

  // Single deleteMany with OR instead of N serial deletes
  if (affectedMonths.size > 0) {
    const monthConditions = [...affectedMonths].map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { userId: coachId, year, month };
    });
    await prisma.monthlySummaryCache.deleteMany({
      where: { OR: monthConditions },
    });
  }

  return NextResponse.json({
    imported: importedCount,
    clients: affectedClientIds.length,
    monthsInvalidated: affectedMonths.size,
  });
}
