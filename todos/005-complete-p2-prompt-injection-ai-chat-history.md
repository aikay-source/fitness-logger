---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, security, ai]
dependencies: ["004"]
---

# 005 — Prompt injection via unsanitized history array in AI chat route

## Problem Statement

The `history` array in `/api/ai/chat` is accepted from `req.json()` with no schema validation, no length limits, and injected verbatim into the Groq system prompt via `buildHistoryContext()`. A crafted history can override system instructions, cause the AI to fabricate data, or trigger unintended session logging.

**Why it matters:** An authenticated user can manipulate AI behavior, potentially causing unintended data writes via the `log` intent path.

## Findings

- `app/app/api/ai/chat/route.ts` lines 158–161: `history` accepted with `as { message: string; history?: HistoryMessage[] }` — no validation
- `buildHistoryContext()` (lines 31–37): builds freeform string injected into system prompt
- `generateReply()` (lines 133–138): history items inserted directly as chat messages to LLM
- Same pattern in `parse-session/route.ts` line 29: user-controlled `text` in user role
- `parse-spreadsheet/route.ts` line 350: AI receives raw cell data (could contain injection payloads)
- `monthly-summary/route.ts` line 64: client names from DB (user-supplied) injected into prompt

## Proposed Solutions

### Option A — Schema validation + length caps (recommended)
```typescript
const MAX_HISTORY = 20;
const MAX_TEXT_LEN = 500;

function validateHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .slice(0, MAX_HISTORY)
    .filter(item =>
      item && typeof item === 'object' &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string'
    )
    .map(item => ({
      role: item.role as 'user' | 'assistant',
      text: String(item.text).slice(0, MAX_TEXT_LEN)
    }));
}
```
- **Pros:** Blocks unbounded injection, enforces type safety
- **Effort:** Small | **Risk:** None

### Option B — Strip prompt delimiter sequences
In addition to validation, strip known prompt injection patterns from text fields before sending to LLM:
```typescript
function sanitizeForLLM(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/<\|/g, '').replace(/\[INST\]/g, '');
}
```
- **Pros:** Defense-in-depth against prompt injection
- **Effort:** Small | **Risk:** Low

## Recommended Action

Implement Option A + Option B together.

## Technical Details

- **Affected files:** `app/app/api/ai/chat/route.ts`

## Acceptance Criteria

- [ ] `history` array is validated before use (max 20 items, max 500 chars each, only valid roles)
- [ ] Invalid history items are silently dropped (not errored)
- [ ] Prompt delimiter sequences stripped from all LLM-bound user input

## Work Log

- 2026-03-28: Found by security-sentinel agent

## Resources

- `app/app/api/ai/chat/route.ts` (lines 31–37, 133–138, 158–161)
- OWASP LLM Top 10: LLM01 Prompt Injection
