---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, database, infrastructure]
dependencies: []
---

# 003 — No PostgreSQL connection pooling on Vercel serverless

## Problem Statement

The Prisma adapter uses a direct `pg` connection to PostgreSQL with no pooler configured. Vercel functions are stateless — each cold start opens a new TCP connection. PostgreSQL has a hard connection limit (typically 25–100 on hobby tiers). Under concurrent load, multiple cold-started function instances exhaust the connection limit, causing `too many connections` errors that bring the entire app down.

**Why it matters:** P1 reliability issue. Under any real concurrent usage, the app will return 500 errors on all database-touching routes. No code fix is sufficient without a pooler.

## Findings

- `app/lib/prisma.ts`: `new PrismaPg({ connectionString: process.env.DATABASE_URL! })` — no pool config
- `pg` driver default: `max: 10` connections per process
- Vercel serverless: each concurrent invocation = new process
- 3 concurrent cold starts × 10 connections = 30 connections (exceeds typical free tier)
- The `globalForPrisma` singleton guard only helps within a single warm process

## Proposed Solutions

### Option A — Use the DB provider's built-in connection pooler (recommended)
On Supabase: use the "Transaction Mode" pooler connection string instead of the direct string. It looks like:
```
postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
Set this as `DATABASE_URL` in Vercel environment variables. Zero code change.
- **Pros:** No code change, handles serverless scaling natively
- **Effort:** Small | **Risk:** Low

### Option B — Cap pool size per function instance (partial fix)
```typescript
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  pool: { max: 1 },
});
```
Limits each cold-started function to 1 connection. 25 concurrent functions = 25 connections (fits in free tier).
- **Pros:** Immediate code fix, no infrastructure change
- **Cons:** Only a mitigation — still creates 1 connection per cold start, can saturate at scale
- **Effort:** Small | **Risk:** Low

### Option C — Prisma Accelerate
Replace the `PrismaPg` adapter with `@prisma/extension-accelerate`. Handles connection pooling, edge compatibility, and optional query caching.
- **Pros:** Best long-term solution, adds query caching
- **Cons:** Requires Prisma account / paid plan at scale, changes adapter setup
- **Effort:** Medium | **Risk:** Low

## Recommended Action

Option A immediately (switch to pooler URL in Vercel env vars) + Option B as a code-level safeguard.

## Technical Details

- **Affected files:** `app/lib/prisma.ts`, Vercel environment variables
- **Components:** PrismaPg adapter, DATABASE_URL

## Acceptance Criteria

- [ ] `DATABASE_URL` points to a connection pooler endpoint (not direct Postgres)
- [ ] Pool size per function instance is capped (max 1–2)
- [ ] No `too many connections` errors under 10+ concurrent users
- [ ] Connection count on the database host stays within tier limits

## Work Log

- 2026-03-28: Found by performance-oracle and architecture-strategist agents

## Resources

- `app/lib/prisma.ts`
- Supabase: Settings → Database → Connection Pooling → Transaction Mode URL
- Prisma docs: Connection management in serverless environments
