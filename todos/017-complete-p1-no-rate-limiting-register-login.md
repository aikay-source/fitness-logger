---
status: complete
priority: p1
issue_id: "017"
tags: [code-review, security, rate-limiting]
dependencies: []
---

# 017 — No rate limiting on register or credentials login endpoints

## Problem Statement

`POST /api/auth/register` and the NextAuth credentials provider have zero rate limiting. An attacker can submit unlimited requests to brute-force passwords, enumerate accounts, or trigger a bcrypt CPU DoS (each register call runs `bcrypt.hash` at 12 rounds, which is intentionally expensive — concurrent requests can saturate Vercel serverless CPU quotas).

## Findings

- `app/app/api/auth/register/route.ts` — no IP-based limiting of any kind
- `app/app/api/auth/[...nextauth]/route.ts` — NextAuth v4 has no built-in rate limiting on the credentials provider
- bcrypt at 12 rounds ≈ 200–400ms CPU per request; 20 concurrent register requests = saturated function

## Proposed Solutions

### Option A: Vercel KV + Upstash Rate Limit (Recommended)
Use `@upstash/ratelimit` with `@vercel/kv` as the store. Add a middleware or inline check at the top of the register route and wrap the NextAuth credentials authorize function.
- **Pros:** Works in serverless (KV store is shared across invocations), battle-tested library
- **Cons:** Requires Upstash KV setup in Vercel (free tier available)
- **Effort:** Medium
- **Risk:** Low

### Option B: Vercel Edge Middleware rate limiting
Use Next.js middleware (`middleware.ts`) to rate-limit all `/api/auth/*` routes at the edge before they reach the function.
- **Pros:** Zero cold start for the limiter itself
- **Cons:** Edge middleware has limited runtime (no Node.js APIs), requires KV store anyway
- **Effort:** Medium
- **Risk:** Low

### Option C: Simple IP-header check with in-memory counter (dev only)
- **Pros:** No external dependency
- **Cons:** Does not survive cold starts — each Vercel invocation has fresh memory. Useless in production.
- **Effort:** Small
- **Risk:** High (false security)

## Recommended Action

Option A. Limits: 5 register attempts per IP per hour, 10 login attempts per IP per 15 minutes.

## Technical Details

- **Affected files:** `app/app/api/auth/register/route.ts`, `app/lib/auth.ts` (authorize callback)
- **Packages needed:** `@upstash/ratelimit`, `@vercel/kv`

## Acceptance Criteria

- [ ] Register endpoint returns 429 after 5 attempts per IP per hour
- [ ] Credentials login returns 429 after 10 failed attempts per IP per 15 minutes
- [ ] Rate limit headers (`Retry-After`) included in 429 responses
- [ ] Legitimate users are not affected under normal usage

## Work Log

- 2026-03-28: Identified by security-sentinel review agent
