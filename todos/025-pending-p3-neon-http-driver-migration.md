---
status: pending
priority: p3
issue_id: "025"
tags: [code-review, performance, database, infrastructure]
dependencies: []
---

# 025 — Migrate from @prisma/adapter-pg to @prisma/adapter-neon for better cold-start performance

## Problem Statement

The current `@prisma/adapter-pg` adapter uses a standard TCP+TLS connection to Neon's pooler. On Vercel serverless cold starts, the first query pays: TCP handshake (~20–40ms) + TLS 1.3 (~15–30ms) + query. Neon's HTTP driver (`@neondatabase/serverless`) speaks HTTP/2 to Neon's edge, skipping the TCP connection entirely and reducing first-query latency to ~10–20ms.

## Findings

- `app/lib/prisma.ts`: uses `@prisma/adapter-pg` with `PrismaPg`
- Cold start first-query overhead: 35–75ms with current adapter vs 10–20ms with Neon HTTP

## Proposed Solutions

### Option A: Migrate to @prisma/adapter-neon
```typescript
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

const sql = neon(process.env.DATABASE_URL!);
const adapter = new PrismaNeon(sql);
```
- **Pros:** 2–3x better cold-start latency, designed for serverless
- **Cons:** Minor API migration, need to test compatibility with Prisma 7
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A when performance becomes a priority.

## Technical Details

- **Affected file:** `app/lib/prisma.ts`
- **Packages:** `@neondatabase/serverless`, `@prisma/adapter-neon`

## Acceptance Criteria

- [ ] Prisma client uses Neon HTTP adapter
- [ ] All existing queries work correctly
- [ ] SSL configuration preserved

## Work Log

- 2026-03-28: Identified by performance-oracle review agent
