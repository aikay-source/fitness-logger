---
status: complete
priority: p1
issue_id: "019"
tags: [code-review, reliability, error-handling]
dependencies: []
---

# 019 — Registration race condition: unhandled P2002 unique constraint violation

## Problem Statement

`POST /api/auth/register` uses a check-then-act pattern (`findUnique` → `create`). Two concurrent requests with the same email can both pass the `findUnique` check before either `create` completes. The second `create` throws a Prisma `P2002` (unique constraint violation) that is not caught, surfacing as an unhandled 500 to the client.

The same race exists in the `jwt` callback in `auth.ts` for Google OAuth sign-in (no try/catch at all around the db calls).

## Findings

- `app/app/api/auth/register/route.ts` lines 20–31: no catch block around `prisma.user.create`
- `app/lib/auth.ts` lines 51–66: jwt callback Google branch has no try/catch

## Proposed Solutions

### Option A: Catch P2002 and return 409 (Recommended)
Wrap `prisma.user.create` in a try/catch. On `PrismaClientKnownRequestError` with code `P2002`, return the 409 conflict response. This makes the endpoint idempotent under concurrent load.

```typescript
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

try {
  await prisma.user.create({ data: { email, name, password: hashedPassword } });
} catch (e) {
  if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }
  throw e;
}
```

- **Pros:** Handles the race correctly, no behavior change for normal cases
- **Effort:** Small
- **Risk:** Very low

### Option B: Use upsert instead of create
Replace the findUnique/create with a single `upsert`. Not appropriate here since registration should fail on existing emails, not silently update.

## Recommended Action

Option A. Also add a try/catch to the jwt callback Google branch.

## Technical Details

- **Affected files:** `app/app/api/auth/register/route.ts`, `app/lib/auth.ts`

## Acceptance Criteria

- [ ] Concurrent registrations with same email return 409 (not 500) for the second request
- [ ] jwt callback Google branch wrapped in try/catch, logs error and returns token as-is on failure

## Work Log

- 2026-03-28: Identified by performance-oracle and architecture-strategist review agents
