---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, security, typescript]
dependencies: ["002"]
---

# 007 — session! non-null assertions in 5 page files

## Problem Statement

Five page files use `session!.user.id` (TypeScript non-null assertion) without an explicit null guard. These are safe today only because `(app)/layout.tsx` redirects unauthenticated users first. But this is an invisible structural dependency — if any page is moved, the layout refactored, or Next.js behavior changes, the assertion becomes a runtime 500 crash instead of a clean redirect.

**Why it matters:** Defense-in-depth failure. Also masks a real type error that the compiler should catch.

## Findings

- `app/app/(app)/clients/page.tsx` line 10: `const coachId = session!.user.id`
- `app/app/(app)/clients/[id]/page.tsx` line 22: `const coachId = session!.user.id`
- `app/app/(app)/dashboard/page.tsx`: same pattern
- `app/app/(app)/settings/SettingsClient.tsx` / `settings/page.tsx`: same pattern
- `app/app/(app)/sessions/new/page.tsx`: same pattern
- `app/lib/auth.ts` line 50: `session.user.id = token.id as string` — unsafe cast; `token.id` is `unknown`

## Proposed Solutions

### Option A — Extract requireSession() helper
Create `app/lib/require-session.ts`:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}
```
Then in each page:
```typescript
const session = await requireSession();
const coachId = session.user.id; // typed, safe, no assertion
```
- **Pros:** Self-documenting, self-protecting, eliminates 12+ duplicate getServerSession imports
- **Effort:** Small | **Risk:** None

### Option B — Inline guard per page
```typescript
const session = await getServerSession(authOptions);
if (!session) redirect("/login");
const coachId = session.user.id;
```
- **Pros:** No abstraction needed
- **Cons:** Repetitive across 12+ files
- **Effort:** Small | **Risk:** None

## Recommended Action

Option A — the helper is worth the minimal abstraction given 12+ call sites.

## Technical Details

- **Affected files:** All 5 `(app)` page files, `app/lib/auth.ts`
- For `token.id as string` in auth.ts: replace with `if (typeof token.id === 'string') session.user.id = token.id;`

## Acceptance Criteria

- [ ] No `session!` non-null assertions remain in any page file
- [ ] Unauthenticated access to any page redirects to `/login` even if layout guard is removed
- [ ] `token.id as string` replaced with type guard in auth.ts

## Work Log

- 2026-03-28: Found by typescript-reviewer, security-sentinel, and architecture-strategist agents

## Resources

- `app/app/(app)/clients/page.tsx` (line 10)
- `app/app/(app)/clients/[id]/page.tsx` (line 22)
- `app/lib/auth.ts` (line 50)
