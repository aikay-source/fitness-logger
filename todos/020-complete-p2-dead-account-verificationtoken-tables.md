---
status: complete
priority: p2
issue_id: "020"
tags: [code-review, architecture, schema]
dependencies: []
---

# 020 — Dead Account and VerificationToken tables in schema (never written to)

## Problem Statement

The Prisma schema defines `Account` and `VerificationToken` models — both are NextAuth PrismaAdapter constructs — but `PrismaAdapter` was removed. Neither table is ever written to. The `User` model has an `accounts Account[]` relation that is also never populated. This creates a contract mismatch: the schema implies OAuth accounts are tracked per-provider, but the implementation doesn't honour it.

## Findings

- `app/prisma/schema.prisma` lines 26–42: full `Account` model with `@@unique([provider, providerAccountId])`
- `app/prisma/schema.prisma` lines 44–50: `VerificationToken` model
- `app/prisma/schema.prisma` line 22: `accounts Account[]` relation on `User`
- No code path writes to either table

## Proposed Solutions

### Option A: Drop both models and the relation (Recommended)
Remove `Account`, `VerificationToken`, and `accounts Account[]` from the schema. Run a migration to drop those tables. This makes the schema accurately reflect what the system does.
- **Pros:** Eliminates confusion, reduces migration surface, schema matches reality
- **Cons:** Irreversible without re-adding the models (but they're empty tables)
- **Effort:** Small
- **Risk:** Low (tables are empty)

### Option B: Re-add PrismaAdapter and use it properly
Restore `PrismaAdapter` which would actually populate these tables. Provides proper account linking, session management, and token storage.
- **Pros:** Full NextAuth integration, supports future providers
- **Cons:** PrismaAdapter had compatibility issues with Prisma 7 driver adapters (reason it was removed)
- **Effort:** Large
- **Risk:** Medium

## Recommended Action

Option A. Verify tables are empty before running the migration (they should be since nothing writes to them).

## Technical Details

- **Affected file:** `app/prisma/schema.prisma`
- **Migration needed:** `ALTER TABLE ... DROP TABLE "Account", "VerificationToken"` + remove relation

## Acceptance Criteria

- [ ] `Account` and `VerificationToken` models removed from schema.prisma
- [ ] `accounts` relation removed from `User` model
- [ ] Migration created and applied
- [ ] All existing functionality continues to work

## Work Log

- 2026-03-28: Identified by architecture-strategist review agent
