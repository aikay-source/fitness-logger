---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance, database]
dependencies: []
---

# 008 — Session import: O(n) sequential upserts will hit Vercel timeout

## Problem Statement

`app/app/api/sessions/import/route.ts` performs one `prisma.client.create` and one `prisma.session.upsert` per row in a sequential `for` loop. For an import of 500 sessions, this generates 500+ serial round trips to PostgreSQL (each ~10ms on Vercel → 5+ seconds minimum). This exceeds Vercel's 10-second function timeout under realistic import sizes.

**Why it matters:** Large imports will silently fail with a 504 timeout. Data is partially written with no rollback.

## Findings

- `app/app/api/sessions/import/route.ts` lines 33–46: sequential `prisma.client.create` per new client (loop)
- Lines 187–231: sequential `prisma.session.upsert` per session row (loop, inside a transaction)
- Lines 170–181: sequential `prisma.packageEpisode.create` per episode (loop)
- Lines 285–290: sequential `prisma.reportCache.deleteMany` per month (loop)
- No transaction wrapping the full import — partial failures leave orphaned data

## Proposed Solutions

### Option A — Batch with createMany + transaction
1. Collect all new clients → `prisma.client.createManyAndReturn({ data: [...] })`
2. Collect all sessions → `prisma.session.createMany({ data: [...], skipDuplicates: true })`
3. Collect all episodes → `prisma.packageEpisode.createMany({ data: [...] })`
4. Invalidate all affected months in one `deleteMany` with `OR` clause
5. Wrap steps 1–4 in a single `prisma.$transaction([...])`
- **Pros:** Single round trip for each batch; transactional — all-or-nothing
- **Effort:** Medium | **Risk:** Medium (test edge cases)

### Option B — Parallel batches with Promise.all (partial improvement)
Replace sequential loops with `Promise.all()` for independent operations. Keep individual upserts but run concurrently.
- **Pros:** Easier refactor
- **Cons:** Still N round trips, just parallel; doesn't solve transaction safety
- **Effort:** Small | **Risk:** Low

## Recommended Action

Option A for long-term correctness. Option B as a quick interim fix.

## Technical Details

- **Affected files:** `app/app/api/sessions/import/route.ts`
- Note: `createManyAndReturn` is available in Prisma 5+ (this project uses ^7)

## Acceptance Criteria

- [ ] Importing 200 clients + 500 sessions completes in < 3 seconds
- [ ] Failed imports don't leave partial data (full transaction)
- [ ] Existing import tests pass (if any)

## Work Log

- 2026-03-28: Found by performance-oracle agent

## Resources

- `app/app/api/sessions/import/route.ts`
- Prisma docs: createMany, $transaction
