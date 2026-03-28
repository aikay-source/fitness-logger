---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, auth]
dependencies: []
---

# 001 — Auth bypass: no password verification in production

## Problem Statement

The `CredentialsProvider` in `lib/auth.ts` accepts **any password** for any email address and **auto-creates** a new account for unknown emails. This is deployed to production on Vercel. Any person who knows or guesses a coach's email can log in as that user. Anyone can create a new account with an unknown email.

**Why it matters:** Full account takeover with a single HTTP request. Trivial to exploit.

## Findings

- `app/lib/auth.ts` line 31: `// Dev shortcut: any password works — swap for bcrypt before going live` — never acted on
- `app/lib/auth.ts` lines 22–29: auto-creates a user record on first login with any credentials
- No `passwordHash` column in `User` model
- No environment guard (e.g. `NODE_ENV !== 'production'`) to block this in prod

## Proposed Solutions

### Option A — Emergency patch (immediate, minutes)
Add `if (process.env.NODE_ENV === 'production') return null;` at the top of `authorize`. Blocks all logins in prod temporarily until Option B is done.
- **Pros:** Zero risk, immediate
- **Cons:** Breaks existing sessions; requires new login flow
- **Effort:** Small | **Risk:** Low

### Option B — Implement password hashing (permanent fix)
1. Add `passwordHash String?` to `User` model in schema.prisma
2. Run migration
3. Create a `/register` or `/onboarding` flow that hashes passwords with `bcrypt`
4. In `authorize`: call `bcrypt.compare(credentials.password, user.passwordHash)` and return `null` on mismatch
5. Remove the auto-create block — return `null` for unknown users
- **Pros:** Correct solution
- **Cons:** Requires migration and breaking change for existing passwordless accounts
- **Effort:** Medium | **Risk:** Low

### Option C — Switch to a provider with built-in auth (longer term)
Replace `CredentialsProvider` with GitHub/Google OAuth via `@auth/prisma-adapter`. Eliminates password management entirely.
- **Pros:** No passwords to manage
- **Cons:** Significant refactor, requires OAuth app setup
- **Effort:** Large | **Risk:** Medium

## Recommended Action

Do Option A immediately as an emergency block, then implement Option B.

## Technical Details

- **Affected files:** `app/lib/auth.ts`, `app/prisma/schema.prisma`
- **Components:** NextAuth CredentialsProvider, User model

## Acceptance Criteria

- [ ] No login is possible with a wrong or blank password
- [ ] Unknown emails do not auto-create accounts
- [ ] Existing legitimate users can still authenticate
- [ ] Password is stored as a bcrypt hash (cost factor ≥ 12)

## Work Log

- 2026-03-28: Found by security-sentinel, typescript, and architecture review agents

## Resources

- `app/lib/auth.ts`
- OWASP Authentication Cheat Sheet
