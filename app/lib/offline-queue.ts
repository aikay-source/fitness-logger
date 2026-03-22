import { openDB } from "idb";

type QueuedSession = {
  id: string;
  clientIds: string[];
  date: string; // ISO string
  notes?: string;
  createdAt: number;
};

const DB_NAME = "fitlog-offline";
const STORE = "session-queue";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
}

export async function enqueueSession(
  session: Omit<QueuedSession, "id" | "createdAt">
): Promise<void> {
  const db = await getDB();
  await db.put(STORE, {
    ...session,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
}

export async function getPendingSessions(): Promise<QueuedSession[]> {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function removeSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}
