---
status: complete
priority: p2
issue_id: "022"
tags: [code-review, security, input-validation]
dependencies: []
---

# 022 — Missing email format validation and password max-length in register endpoint

## Problem Statement

`POST /api/auth/register` only checks that `rawEmail` is truthy and `password.length >= 8`. There is no email format validation, no max email length (RFC limit: 254 chars), and no max password length. bcrypt silently truncates passwords at 72 bytes — a user setting a 200-char password gets the same hash as a 72-char prefix, which is surprising and undocumented. A 1MB password string is also accepted and parsed before bcrypt truncates it.

## Findings

- `app/app/api/auth/register/route.ts` lines 9–17: only truthy + length >= 8 checks

## Proposed Solutions

### Option A: Add zod validation schema (Recommended)
```typescript
import { z } from "zod";
const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
});
const parsed = schema.safeParse({ email: rawEmail, password });
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
}
```
- **Pros:** Declarative, type-safe, catches all edge cases
- **Cons:** Adds zod dependency (may already be present)
- **Effort:** Small
- **Risk:** Very low

### Option B: Manual regex + length checks
- **Pros:** No new dependency
- **Cons:** Easy to get wrong, maintenance burden
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A. Check if zod is already in `package.json` first.

## Technical Details

- **Affected file:** `app/app/api/auth/register/route.ts`

## Acceptance Criteria

- [ ] Email validated as valid format, max 254 chars
- [ ] Password max 72 chars with clear error message explaining bcrypt limit
- [ ] Invalid inputs return 400 with descriptive message

## Work Log

- 2026-03-28: Identified by security-sentinel review agent
