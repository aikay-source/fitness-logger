---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security, performance, ai]
dependencies: []
---

# 004 — No rate limiting on AI endpoints (Groq credit exhaustion risk)

## Problem Statement

All 5 AI-backed endpoints (`/api/ai/chat`, `/api/ai/parse-session`, `/api/ai/parse-spreadsheet`, `/api/ai/monthly-summary`, `/api/reports/monthly`) call the Groq API on every request with zero rate limiting. Any authenticated user can exhaust the entire Groq API credit quota in minutes. `parse-spreadsheet` also accepts unbounded `rawData` arrays.

**Why it matters:** Financial exposure (API costs), service disruption for all users if quota is exhausted.

## Findings

- No rate limiting middleware or per-user counters on any AI route
- `app/app/api/ai/chat/route.ts`: 2 serial Groq calls per query intent (classify + reply)
- `app/app/api/ai/parse-spreadsheet/route.ts`: accepts `rawData` array with no size cap; no `max_tokens` set
- `app/app/api/ai/monthly-summary/route.ts`: no `max_tokens` set
- `app/app/api/reports/monthly/route.ts`: calls Groq with no token limit

## Proposed Solutions

### Option A — In-memory rate limiter (simple, zero infra)
Use `lru-cache` with a sliding window per user ID:
```typescript
import { LRUCache } from 'lru-cache';
const rateLimiter = new LRUCache<string, number>({ max: 500, ttl: 60_000 });

function checkRateLimit(userId: string, limit: number): boolean {
  const count = rateLimiter.get(userId) ?? 0;
  if (count >= limit) return false;
  rateLimiter.set(userId, count + 1);
  return true;
}
```
In each route: `if (!checkRateLimit(coachId, 30)) return new NextResponse('Rate limit exceeded', { status: 429 });`
- **Pros:** Zero infra cost, works immediately
- **Cons:** Per-instance (doesn't aggregate across Vercel function instances); resets on cold start
- **Effort:** Small | **Risk:** Low

### Option B — Vercel KV / Upstash Redis (distributed, accurate)
Use `@upstash/ratelimit` with a sliding window in Redis. Accurate across all function instances.
- **Pros:** Correct across concurrent invocations
- **Cons:** Requires Upstash account (free tier available), adds a Redis call to every AI request
- **Effort:** Small-Medium | **Risk:** Low

### Option C — Input size caps only (partial mitigation)
Add hard caps on request body sizes immediately, regardless of rate limiting strategy:
- `history` array: max 20 items, each `text` max 500 chars
- `rawData` array: max 200 rows × 20 columns
- `text` field in parse-session: max 5000 chars
- Add `max_tokens: 500` to all Groq calls that lack it
- **Effort:** Small | **Risk:** None

## Recommended Action

Implement Option C immediately (input caps, takes 30 minutes). Then Option A or B for rate limiting.

## Technical Details

- **Affected files:** `app/app/api/ai/chat/route.ts`, `app/app/api/ai/parse-session/route.ts`, `app/app/api/ai/parse-spreadsheet/route.ts`, `app/app/api/ai/monthly-summary/route.ts`, `app/app/api/reports/monthly/route.ts`

## Acceptance Criteria

- [ ] Each AI endpoint returns 429 after exceeding per-user limit (e.g. 30/min for chat, 10/min for parse)
- [ ] `history` array capped at 20 items, each item text capped at 500 chars
- [ ] `rawData` in parse-spreadsheet capped at 200 rows
- [ ] All Groq calls have explicit `max_tokens` set

## Work Log

- 2026-03-28: Found by security-sentinel agent

## Resources

- `app/app/api/ai/chat/route.ts`
- `app/app/api/ai/parse-spreadsheet/route.ts`
- Upstash Ratelimit docs: https://upstash.com/docs/redis/sdks/ratelimit/overview
