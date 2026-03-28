---
status: complete
priority: p2
issue_id: "023"
tags: [code-review, security, session-management]
dependencies: []
---

# 023 — JWT sessions have 30-day lifetime with no revocation mechanism

## Problem Statement

`strategy: "jwt"` with NextAuth's default 30-day expiry means a stolen session cookie is valid for up to 30 days with no way to revoke it. Deleting a user from the database does not invalidate their token — they can still authenticate for the remainder of the JWT lifetime. There is also no "sign out all devices" capability.

## Findings

- `app/lib/auth.ts` line 43: `session: { strategy: "jwt" }` — no `maxAge` override
- Default NextAuth JWT maxAge: 2,592,000 seconds (30 days)
- No token version field on User model to enable revocation

## Proposed Solutions

### Option A: Reduce maxAge to 24 hours (Quick win)
```typescript
session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
```
Limits stolen token window to 24 hours. Rolling sessions (NextAuth default) keep active users logged in.
- **Effort:** Trivial
- **Risk:** Very low

### Option B: Add tokenVersion to User + check in jwt callback
Add `tokenVersion Int @default(0)` to the User model. Store it in the JWT. On each jwt callback, verify `token.tokenVersion === dbUser.tokenVersion`. Increment to revoke all tokens.
- **Pros:** True revocation capability
- **Cons:** Requires DB lookup on every jwt refresh — defeats JWT strategy purpose
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A immediately. Option B if account takeover becomes a concern.

## Technical Details

- **Affected file:** `app/lib/auth.ts`

## Acceptance Criteria

- [ ] JWT maxAge set to 24 hours (or other intentional value)
- [ ] Value documented with a comment explaining the tradeoff

## Work Log

- 2026-03-28: Identified by security-sentinel review agent
