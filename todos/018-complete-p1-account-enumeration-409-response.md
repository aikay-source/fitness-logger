---
status: complete
priority: p1
issue_id: "018"
tags: [code-review, security, information-disclosure]
dependencies: []
---

# 018 — Account enumeration via 409 response on registration

## Problem Statement

`POST /api/auth/register` returns a distinct HTTP 409 with `"An account with that email already exists."` when an email is already registered. Combined with no rate limiting (todo 017), an attacker can silently enumerate whether any email address has an account by automating registrations and checking the response code.

## Findings

- `app/app/api/auth/register/route.ts` line 22: explicit 409 + disclosure message
- No timing-safe response to prevent side-channel enumeration

## Proposed Solutions

### Option A: Silent success pattern (Recommended)
Return 201 regardless of whether the email existed. Send an email to the already-registered address saying "someone tried to register with your account — if this was you, sign in instead."
- **Pros:** Industry standard (used by GitHub, Google). Eliminates enumeration.
- **Cons:** Requires an email-sending integration (Resend is already configured in env but not wired up)
- **Effort:** Medium
- **Risk:** Low

### Option B: Keep 409 but add strict rate limiting
Pair todo 017's rate limiting with this endpoint so enumeration is impractical.
- **Pros:** Simpler, preserves immediate UX feedback
- **Cons:** Rate limiting can be bypassed with distributed IPs; doesn't fully eliminate the risk
- **Effort:** Small (dependent on 017)
- **Risk:** Medium

## Recommended Action

Option B as an immediate mitigation (implement 017 first). Schedule Option A for when email sending is wired up.

## Technical Details

- **Affected file:** `app/app/api/auth/register/route.ts` line 22

## Acceptance Criteria

- [ ] Either: 409 is paired with rate limiting from todo 017
- [ ] Or: Registration returns same response for new and existing emails, with email notification to existing user

## Work Log

- 2026-03-28: Identified by security-sentinel review agent
