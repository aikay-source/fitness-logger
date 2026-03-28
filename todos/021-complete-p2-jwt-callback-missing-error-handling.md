---
status: complete
priority: p2
issue_id: "021"
tags: [code-review, reliability, error-handling]
dependencies: [019]
---

# 021 — jwt callback has no error handling around database calls

## Problem Statement

The `jwt` callback's Google OAuth branch performs `prisma.user.findUnique` and conditionally `prisma.user.create` with no try/catch. An uncaught exception in a NextAuth callback surfaces as a generic `SIGNIN_SERVER_ERROR` page with no useful message for the user. The `authorize` callback (credentials) already has a try/catch — these should be consistent.

## Findings

- `app/lib/auth.ts` lines 51–66: no error boundary around db calls in jwt callback
- `app/lib/auth.ts` lines 21–39: `authorize` has try/catch — inconsistency with jwt

## Proposed Solutions

### Option A: Wrap jwt db calls in try/catch (Recommended)
```typescript
if (account?.provider === "google" && profile?.email) {
  try {
    const email = profile.email.toLowerCase();
    let dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) {
      dbUser = await prisma.user.create({ data: { email, name: ... } });
    }
    token.id = dbUser.id;
  } catch (error) {
    console.error("[jwt] Google sign-in db error:", error);
    // Return token without id — downstream session check will handle unauthenticated state
  }
}
```
- **Effort:** Small
- **Risk:** Very low

## Recommended Action

Option A.

## Technical Details

- **Affected file:** `app/lib/auth.ts` lines 51–66

## Acceptance Criteria

- [ ] jwt callback Google branch wrapped in try/catch
- [ ] Error logged with `[jwt]` prefix
- [ ] Token returned gracefully on failure (no unhandled exception)

## Work Log

- 2026-03-28: Identified by architecture-strategist and performance-oracle review agents
