---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, security, oauth, account-linking]
dependencies: []
---

# 024 — OAuth account pre-hijacking: Google sign-in silently merges with credentials account

## Problem Statement

The jwt callback silently merges a Google OAuth sign-in with an existing email/password account (finds by email, returns the same user row). While the email normalization fix prevents duplicate accounts, it also means: an attacker who controls a Google account with a target's email address (e.g., if Google ever issues the same address to a new user after deletion, or via a lookalike domain) gains access to the credentials-created account without knowing the password.

The reverse is also a UX problem: a Google-only user (no password) who tries credentials login gets a silent "invalid credentials" with no path to recovery.

## Findings

- `app/lib/auth.ts` lines 51–66: no check for whether found user has `password` set before merging
- `app/lib/auth.ts` lines 29: `if (!user || !user.password) return null` — Google-only users silently fail credentials login

## Proposed Solutions

### Option A: Add "signed up with Google" error for credentials lockout (Quick win)
In `authorize`, when a user exists but has no password, throw `new Error("GOOGLE_ACCOUNT")` instead of returning null. Handle this in the login page to show "This account uses Google sign-in — please continue with Google."
- **Effort:** Small
- **Risk:** Very low

### Option B: Block Google sign-in if credentials account exists (Safer)
In the jwt callback, if `dbUser.password` is set, reject the Google sign-in and redirect to login with a "please sign in with email/password" message. Prevents silent account merging.
- **Effort:** Medium
- **Risk:** Low

### Option C: Require explicit account linking (Full solution)
Show a "Link Google to your existing account" confirmation flow before merging. Standard pattern for OAuth account linking.
- **Effort:** Large
- **Risk:** Medium

## Recommended Action

Option A immediately (unblocks locked-out users). Evaluate Option B based on risk appetite.

## Technical Details

- **Affected files:** `app/lib/auth.ts`, `app/app/login/page.tsx`

## Acceptance Criteria

- [ ] Users locked out of credentials login due to Google-only account see a helpful error message
- [ ] Error message directs them to "Continue with Google"

## Work Log

- 2026-03-28: Identified by architecture-strategist and security-sentinel review agents
