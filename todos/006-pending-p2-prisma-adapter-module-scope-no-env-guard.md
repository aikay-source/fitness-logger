---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, architecture, database]
dependencies: ["003"]
---

# 006 — Prisma adapter instantiated at module scope with no DATABASE_URL guard

## Problem Statement

`lib/prisma.ts` creates the `PrismaPg` adapter unconditionally at module load time, before the singleton guard runs. In development with HMR, this creates a new adapter on every hot reload even when the `PrismaClient` singleton is reused. The `!` assertion on `DATABASE_URL` causes a cryptic PostgreSQL connection error if the env var is missing, rather than a clear configuration error.

**Why it matters:** Misleading connection count in development; cryptic failures in misconfigured deployments (e.g. a preview deployment without `DATABASE_URL` set).

## Findings

- `app/lib/prisma.ts` lines 8–10: `const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })` runs before the `globalForPrisma.prisma ?? ...` check
- The adapter is instantiated even when `globalForPrisma.prisma` already holds a valid singleton
- `DATABASE_URL!` — TypeScript assertion silently passes `undefined` to `PrismaPg` if env var is unset, resulting in a confusing runtime error
- In production (Vercel), module-level code runs on every cold start — minor issue but causes unnecessary setup cost

## Proposed Solutions

### Option A — Move adapter inside a factory function (recommended)
```typescript
function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```
- **Pros:** Adapter only created when needed; clear error message for missing env var
- **Effort:** Small | **Risk:** None

## Recommended Action

Implement Option A. 5-minute fix.

## Technical Details

- **Affected files:** `app/lib/prisma.ts`

## Acceptance Criteria

- [ ] Adapter is only created when `PrismaClient` singleton doesn't already exist
- [ ] Missing `DATABASE_URL` throws `Error: DATABASE_URL environment variable is not set`
- [ ] No `!` assertion on `DATABASE_URL`
- [ ] Dev HMR no longer creates multiple adapter instances

## Work Log

- 2026-03-28: Found by typescript-reviewer, architecture-strategist, and security-sentinel agents

## Resources

- `app/lib/prisma.ts`
- Previous `createPrismaClient()` pattern (visible in git diff HEAD~5)
