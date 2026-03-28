---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, auth]
dependencies: []
---

# 002 — Middleware deleted: route protection missing from deployed app

## Problem Statement

`app/middleware.ts` was deleted and replaced with `app/proxy.ts` (same content, different name). Next.js only loads `middleware.ts` — `proxy.ts` is ignored and untracked. The deployed app on Vercel has **no middleware-level route protection**. The `(app)/layout.tsx` guard partially compensates for page routes, but five page files use `session!.user.id` (non-null assertion) that will crash with a 500 rather than redirect if session is null.

**Why it matters:** Defense-in-depth is broken. One layout refactor away from unauthenticated access to all page routes.

## Findings

- `app/middleware.ts` — deleted (tracked as `D` in git status)
- `app/proxy.ts` — correct content but untracked and ignored by Next.js
- `app/app/(app)/clients/page.tsx` line 10: `session!.user.id`
- `app/app/(app)/clients/[id]/page.tsx` line 22: `session!.user.id`
- `app/app/(app)/dashboard/page.tsx`, `settings/page.tsx`, `sessions/new/page.tsx` — similar patterns

## Proposed Solutions

### Option A — Rename proxy.ts to middleware.ts (immediate fix)
```bash
git mv app/proxy.ts app/middleware.ts
git add app/middleware.ts
git commit -m "fix: restore auth middleware (rename proxy.ts → middleware.ts)"
```
- **Pros:** Instant fix, zero logic change needed
- **Effort:** Small | **Risk:** None

### Option B — Replace session! with explicit guards in each page
In each `(app)` page:
```typescript
const session = await getServerSession(authOptions);
if (!session) redirect("/login");
const coachId = session.user.id; // now safe, no assertion needed
```
Extract to a shared `requireSession()` helper in `lib/require-session.ts`.
- **Pros:** Pages are self-protecting regardless of layout context
- **Effort:** Small | **Risk:** Low

## Recommended Action

Do both: Option A immediately (restores the missing layer), then Option B (defense-in-depth).

## Technical Details

- **Affected files:** `app/proxy.ts` → `app/middleware.ts`, all `(app)` page files
- **Middleware matcher (correct):** `/((?!login|api/auth|_next/static|_next/image|icons|manifest.json|sw.js|favicon.ico).*)`

## Acceptance Criteria

- [ ] `app/middleware.ts` exists and is committed
- [ ] `app/proxy.ts` is removed or renamed
- [ ] Unauthenticated requests to `/dashboard`, `/clients`, etc. redirect to `/login`
- [ ] No `session!` non-null assertions remain in page files

## Work Log

- 2026-03-28: Found by security-sentinel and architecture review agents

## Resources

- `app/proxy.ts` (the correct content — just rename it)
- `app/app/(app)/layout.tsx` (existing layout guard for reference)
