---
status: pending
priority: p1
issue_id: "016"
tags: [code-review, infrastructure, developer-experience]
dependencies: []
---

# 016 — Local dev broken: DATABASE_URL still points to SQLite after PostgreSQL migration

## Problem Statement

`app/.env.local` still contains `DATABASE_URL="file:./dev.db"` — the old SQLite connection string. The codebase was migrated to use `@prisma/adapter-pg` (PostgreSQL), so `PrismaPg` now receives a SQLite file path as a PostgreSQL connection string and fails to connect. Login and all database operations fail locally.

**Discovered:** browser testing — login returned "Could not sign in. Please try again."

**Why it matters:** Local development is completely broken after the PostgreSQL migration. No dev can run the app locally without manually updating `.env.local`.

## Findings

- `app/.env.local` line 1: `DATABASE_URL="file:./dev.db"` — SQLite format, not PostgreSQL
- `app/lib/prisma.ts`: `new PrismaPg({ connectionString: process.env.DATABASE_URL! })` — passes `"file:./dev.db"` to the PostgreSQL adapter
- Vercel production works because Vercel's environment variables dashboard has the real PostgreSQL URL set separately
- `app/.env` (the template file) likely also has a stale value

## Proposed Solutions

### Option A — Update .env.local with real PostgreSQL connection string
Get the connection string from Vercel:
1. Vercel Dashboard → Project → Settings → Environment Variables → `DATABASE_URL`
2. Copy the value
3. Update `app/.env.local`: `DATABASE_URL="postgresql://..."`

For local dev, use the **direct connection** URL (not the pooler) since local dev is a single process, not serverless.
- **Effort:** Trivial | **Risk:** None

### Option B — Update .env template to guide future devs
Update `app/.env` (the template) to show the expected PostgreSQL format:
```
# PostgreSQL connection string — get from Vercel dashboard or your DB provider
# For Supabase: use the "Direct connection" URL for local dev
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```
- **Effort:** Trivial | **Risk:** None

## Recommended Action

Both: Option A immediately (fix your local env), Option B so future contributors know what format is expected.

## Technical Details

- **Affected files:** `app/.env.local` (not committed — update manually), `app/.env` (template — commit the format update)

## Acceptance Criteria

- [ ] `app/.env.local` has a valid `postgresql://` connection string
- [ ] Login succeeds locally
- [ ] `app/.env` template shows the expected PostgreSQL URL format (not `file:./dev.db`)

## Work Log

- 2026-03-28: Discovered during browser testing — login failed with "Could not sign in"
- 2026-03-28: Root cause confirmed: `DATABASE_URL="file:./dev.db"` in .env.local (SQLite path passed to PrismaPg)

## Resources

- `app/.env.local` (local only, not committed)
- Vercel Dashboard → Settings → Environment Variables
