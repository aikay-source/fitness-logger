import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The `pg` library does not parse `sslmode=require` out of the connection
// string on its own. Neon (and most hosted Postgres providers) require SSL,
// so we must pass the ssl option explicitly in the config object (first arg),
// otherwise the connection is attempted without TLS and is rejected in
// production.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined,
  // Vercel serverless: each cold-start opens a new process. Cap at 1 connection
  // per function instance so 25 concurrent invocations stay within free-tier
  // connection limits. For true connection pooling, point DATABASE_URL at your
  // provider's built-in pooler (Neon: "Pooled connection" string).
  max: 1,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
