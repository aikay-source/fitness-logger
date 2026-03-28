---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, security]
dependencies: []
---

# 013 — No HTTP security headers in next.config.ts

## Problem Statement

`next.config.ts` has no `headers()` export. The following security headers are absent: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Findings

- `app/next.config.ts`: no `headers()` export
- App can be iframed (clickjacking risk)
- No restriction on external script sources

## Proposed Solutions

Add to `next.config.ts`:
```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
}
```
A full CSP is more involved (requires auditing all external sources including Groq API domain).
- **Effort:** Small (headers above) / Medium (full CSP) | **Risk:** None for basic headers

## Acceptance Criteria

- [ ] `X-Frame-Options: DENY` header present on all responses
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Referrer-Policy` set

## Work Log

- 2026-03-28: Found by security-sentinel agent
