---
title: "feat: Session History Import, Retrieval, and Natural Language Query"
type: feat
status: active
date: 2026-03-25
---

# Session History Import, Retrieval, and Natural Language Query

Coaches need to upload their historical session records (spreadsheets with dates), have those stored as individual dated `Session` rows in the database, and retrieve them at any time — including typing "how many sessions did Kate have in March?" and getting an accurate answer drawn from real records.

---

## Overview

The `Session` model and its full import pipeline (`/api/sessions/import`) already exist. The per-client month-by-month history view is **already rendered** on the client detail page. The only missing piece is the **ingestion path**: the AI parser needs to recognise spreadsheets that contain actual dates and emit per-date session records instead of just aggregated client totals.

Once ingested, the existing UI answers the coach's query natively: the client detail page shows sessions grouped by month, each group showing its count.

---

## Problem Statement

**Current**: `Smart Import` always aggregates the spreadsheet into client totals (`totalSessionsPurchased`, `sessionsRemaining`, `unpaidSessions`) and discards the date-level detail. A coach who uploads a year of session logs loses all the "when" information.

**Needed**: When a spreadsheet has an identifiable date column/row (e.g. column A contains `2024-09-03`, `2024-09-10`, …), the parser should extract `(date, clientName, sessionNumber, packageSize, paid)` tuples, store them as `Session` records, and surface them in the per-client history view that already exists.

---

## What Already Works (Don't Rebuild)

| Component | Location | Status |
|-----------|----------|--------|
| `Session` DB model | `app/prisma/schema.prisma:82` | ✅ Complete |
| `ParsedSessionEntry` type | `app/app/api/ai/parse-spreadsheet/route.ts:7` | ✅ Complete |
| `/api/sessions/import` full pipeline | `app/app/api/sessions/import/route.ts` | ✅ Complete |
| Per-client month-grouped history view | `app/app/(app)/clients/[id]/page.tsx:38–235` | ✅ Complete |
| Monthly summary cache invalidation | `app/app/api/sessions/import/route.ts:267–280` | ✅ Complete |
| `MonthlySummaryCache` + `/api/reports/monthly` | schema + API | ✅ Complete |

---

## Proposed Solution

### Phase 1 — Enhance the AI parser to detect dated session logs

Add a third format path to `parse-spreadsheet/route.ts`: **session-history**.

**Detection logic** (deterministic, before calling AI):
```
If ≥ 40% of non-empty column-A cells are valid dates (ISO, DD/MM/YYYY, MM/DD/YYYY)
→ treat as a dated session log (rows = dates, columns = clients)
```

This is added as a new branch before the existing `isSessionGrid` check.

**AI prompt** for session-history format:

```
Each row has a date in column A and client attendance in the remaining cells.
Cells look like "Kate9/11" (session 9 of 11 package), "Lulu3/u" (3 unpaid sessions),
or "Philip" (bare name, unpaid).

Extract every (date, clientName, sessionNumber, packageSize, paid) tuple.
Return JSON: { "sessions": [ { "date": "YYYY-MM-DD", "name": "string",
  "sessionNumber": number|null, "packageSize": number|null, "paid": boolean } ] }
```

**New return format added to `ParseSpreadsheetResult` union**:
```typescript
| { format: "session-history"; sessions: ParsedSessionEntry[] }
```

### Phase 2 — Route session-history imports through `/api/sessions/import`

In `app/app/(app)/clients/import/page.tsx`:

1. When `aiResult.format === "session-history"`, show a **dated preview**:
   - Group entries by client, show how many sessions per client
   - Show the date range (earliest → latest)
   - Warn: "Existing sessions on the same dates will be updated"
2. On confirm, POST to `/api/sessions/import` with `{ sessions: aiResult.sessions }`
3. On success, navigate to `/clients` (the import route already updates all client flat totals)

### Phase 3 — Surface the query on client detail

The client detail page already renders sessions grouped by month with counts. No new page is needed.

Add a **quick-stats callout** at the top of the history section:
- "X sessions across Y months"
- Each month group already shows its count implicitly (number of rows); make it explicit by adding `(N)` to the `<summary>` line: e.g. `September 2024 (8 sessions)`

No new API endpoint is needed — all data is fetched in the server component at page load.

### Phase 4 — Unified chat interface on the dashboard homepage

A single chat input on the **dashboard** (`/dashboard`) that handles both **logging** and **querying** from one place. The coach never needs to navigate away — they type naturally and the app figures out what to do.

**Example inputs (both work in the same box):**
- `"trained Kate and Marcus this morning"` → logs 2 sessions for today
- `"how many sessions did Kate have in March?"` → queries DB, answers inline
- `"logged John and Sarah yesterday"` → logs for yesterday
- `"who trained the most last month?"` → queries and answers

**Intent classification first, then act:**

```
Coach types in chat box on dashboard
       │
       ▼
POST /api/ai/chat
  Step 1 — Groq classifies intent:
    → { intent: "log" | "query" | "unknown", ... }

  If "log":
    ├─ Extract names + optional date from text
    ├─ Fuzzy-match names → client records (existing @/lib/fuzzy-match)
    └─ Return { type: "log-confirm", matches: [...], date, unmatched: [...] }
         → UI shows inline confirm card: "Log 2 sessions for today? ✓ / ✗"
         → On confirm: call existing logSession server action

  If "query":
    ├─ Extract { queryIntent, clientName?, year?, month? }
    ├─ Fuzzy-match clientName → client record
    ├─ Prisma query (deterministic, no AI)
    └─ Return { type: "answer", text: "Kate had 8 sessions in March 2025." }

  If "unknown":
    └─ Return { type: "answer", text: "I can log sessions or answer questions about history…" }
```

**Supported query intents (all answered from real DB data):**

| Query | Prisma operation |
|-------|-----------------|
| "How many sessions did Kate have in March?" | `session.count({ where: { clientId, date ≥ Mar 1, < Apr 1 } })` |
| "How many did Kate train in 2025?" | `session.count({ where: { clientId, date ≥ Jan 1, < Jan 1 next } })` |
| "Who trained the most last month?" | `session.findMany` + group by clientId + sort |
| "How many sessions total in March?" | `session.count({ where: { coachId, date ≥, < } })` |
| "Did Sarah train in February?" | `session.findFirst` → yes/no answer |

**New API route: `POST /api/ai/chat`**

```typescript
// Request
{ message: string }

// Response — discriminated union
| { type: "log-confirm"; matches: MatchResult[]; date: string; unmatched: string[] }
| { type: "answer"; text: string }
| { type: "error"; text: string }
```

**Chat UI — replaces the "Log today's sessions" button on the dashboard**

The dashboard currently has a prominent `<Link href="/sessions/new">Log today's sessions</Link>` button at the top. This is replaced by a persistent chat input. The quick-stats and alerts sections stay below it as-is.

Layout:
```
Good morning, [Coach].
─────────────────────────────────────────────
[  Type to log sessions or ask anything…  ] [↵]
─────────────────────────────────────────────

  ┌ assistant ──────────────────────────────┐
  │ Ready to log 2 sessions for today?      │
  │  ✓ Kate  · 3 sessions left after        │
  │  ✓ Marcus · 1 session left after        │
  │  [Confirm]  [Cancel]                    │
  └─────────────────────────────────────────┘

  ┌ assistant ──────────────────────────────┐
  │ Kate had 8 sessions in March 2025.      │
  └─────────────────────────────────────────┘

[Heads up alerts, stats, recent activity…]
```

- Chat history: last 8 messages kept in React state (not persisted — clears on refresh)
- Input: single-line `<input>` + send button (Enter or click). No textarea.
- Log confirmation card has Confirm + Cancel buttons. Confirm calls the existing `logSession` server action.
- Offline: if `!navigator.onLine`, queue via existing `enqueueSession` (same as current SessionLogger)
- The `/sessions/new` page remains as a fallback for manual/checkbox logging — the nav "Log" tab still links there

**`DashboardClient.tsx`** — new client component island for the chat

The current `DashboardPage` is a pure server component. Extract a `DashboardClient.tsx` island that receives `clients` as a prop and renders the chat. The server component continues to fetch all the stats (low alerts, unpaid, month count) and passes them as props alongside `clients`.

---

## Technical Considerations

### Date parsing from spreadsheets

Column A cells may contain dates in several formats:
- ISO: `2024-09-03`
- UK: `03/09/2024`
- US: `09/03/2024`
- Excel serial numbers: `45567` (days since 1900-01-01)

The AI prompt should normalise all to `YYYY-MM-DD`. An alternative is to parse the raw `Date` objects from XLSX (when reading xlsx files, `cellDates: true` gives native JS dates directly).

**Recommended**: For xlsx files, use `XLSX.utils.sheet_to_json` with `{ cellDates: true }` and convert column-A Date objects to `YYYY-MM-DD` strings before sending to the AI. For CSV, pass raw strings to the AI and let it normalise.

### Deduplication

`/api/sessions/import` already uses `session.upsert` keyed on `@@unique([clientId, dateKey])`. Re-uploading the same spreadsheet is idempotent — existing sessions are overwritten, not duplicated.

### Manual sessions vs imported sessions

`dateKey` is `null` for manually-logged sessions, so the unique constraint doesn't apply to them. A manual session on the same day as an imported one will coexist. This is acceptable — manual sessions are always user-authored.

### Month grouping timezone consistency

The existing `[id]/page.tsx` groups by `new Date(s.date).getFullYear()` and `.getMonth()` (0-indexed). The import stores dates as `new Date(entry.date)` (UTC midnight). On a UTC server these are consistent. Do not change the grouping logic — it works correctly.

---

## System-Wide Impact

- **Interaction graph**: Upload → `parse-spreadsheet` → AI (Groq `llama-3.3-70b-versatile`) → `sessions/import` → `prisma.session.upsert` (N times) → `prisma.client.update` (per affected client) → `prisma.monthlySummaryCache.deleteMany` (affected months). Client detail page re-fetches on next load.
- **Error propagation**: Groq failures return `{ format: "unknown" }` → user sees "AI couldn't read this file, switching to manual". Sessions import failures toast an error and stay on the confirm step.
- **State lifecycle risks**: If `sessions/import` fails mid-upsert, some sessions are stored and some aren't. The upsert is idempotent so a retry recovers cleanly. `PackageEpisode` deletion happens before recreation — a failure after deletion but before recreation leaves the client with no episodes (acceptable; flat client fields are still correct).
- **Cache invalidation**: Already handled — `sessions/import` deletes `MonthlySummaryCache` for all affected months. The AI narrative regenerates on next Reports page visit.

---

## Acceptance Criteria

- [ ] Uploading a spreadsheet where column A contains dates routes to the **session-history** AI path
- [ ] `parse-spreadsheet` returns `{ format: "session-history", sessions: ParsedSessionEntry[] }` for dated grids
- [ ] Import preview shows: client count, session count, date range, overwrite warning
- [ ] Confirming import POSTs to `/api/sessions/import` and creates `Session` rows with correct dates
- [ ] Re-uploading the same spreadsheet is idempotent (no duplicate sessions)
- [ ] Client detail page history section shows the imported sessions grouped by month
- [ ] Each month group in the history section displays its session count, e.g. `September 2024 (8 sessions)`
- [ ] Client flat totals (`totalSessionsPurchased`, `sessionsRemaining`, `unpaidSessions`) are updated after import
- [ ] Monthly summary cache is invalidated for all affected months on import
- [ ] If AI returns no sessions (empty array), user is shown a helpful error and offered manual mapping fallback
- [ ] Dashboard homepage has a persistent chat input replacing the "Log today's sessions" button
- [ ] Typing "trained Kate and Marcus today" logs sessions inline without leaving the page
- [ ] Typing "how many sessions did Kate have in March?" returns the exact count from the DB
- [ ] Both logging and querying work from the same input box — intent is classified automatically
- [ ] Log confirmation card shows matched clients with sessions-remaining-after, unmatched names highlighted
- [ ] Confirming a log calls the existing `logSession` server action and shows a success message in chat
- [ ] Client name matching is fuzzy (handles partial names, case-insensitive, typos)
- [ ] Unrecognised query intent returns a friendly fallback listing what the chat can do
- [ ] Chat history shows last 8 messages in the current browser session (not persisted)
- [ ] Answers are grounded in real DB data — the AI only classifies intent, never invents counts
- [ ] Offline: log intents are queued via `enqueueSession` when `!navigator.onLine`
- [ ] `/sessions/new` manual logging page remains accessible from the nav as a fallback

---

## Implementation Checklist

### `app/app/api/ai/parse-spreadsheet/route.ts`

- [ ] Add `isDateCell(cell: string): boolean` helper (checks ISO, DD/MM/YYYY, US, Excel serial)
- [ ] Add `isSessionHistoryGrid(rawData: string[][]): boolean` — returns true if ≥40% of non-empty column-A cells are dates
- [ ] Add `handleSessionHistory(rawData: string[][], grid: string[][]): Promise<NextResponse>` — calls Groq, returns `{ format: "session-history", sessions: ParsedSessionEntry[] }`
- [ ] Update `ParseSpreadsheetResult` union type to include `session-history` variant
- [ ] In `POST` handler: check `isSessionHistoryGrid` before `isSessionGrid`

### `app/app/(app)/clients/import/page.tsx`

- [ ] Add `session-history` branch in `handleAiParse` — no `summariseSessionEntries` needed; use `aiResult.sessions` directly
- [ ] Build `sessionHistoryPreview`: group `aiResult.sessions` by client name, count sessions, extract date range
- [ ] Render dated preview: client list with session count per client + overall date range banner + overwrite warning
- [ ] In `handleImport`: when `aiResult.format === "session-history"`, POST `{ sessions: aiResult.sessions }` to `/api/sessions/import`
- [ ] Update `totalToImport` for session-history (show client count, not session count, in button label)

### `app/app/(app)/clients/[id]/page.tsx`

- [ ] Add session count to each month `<summary>` label: `{MONTH_NAMES[group.month]} {group.year} ({group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''})`
- [ ] Add overall history summary line above the month list: "X sessions logged across Y months"

### `app/app/api/ai/chat/route.ts` (new file)

- [ ] Accept `POST { message: string }`, require auth via `getServerSession`
- [ ] Step 1 — Groq classifies intent: `{ intent: "log" | "query", names?: string[], date?: string, queryType?, clientName?, year?, month? }`
  - Include today's date in system prompt for relative date resolution ("yesterday", "last month")
- [ ] If `intent === "log"`:
  - Fuzzy-match extracted names against `prisma.client.findMany({ where: { coachId } })`
  - Return `{ type: "log-confirm", matches, date, unmatched }`
- [ ] If `intent === "query"`:
  - Fuzzy-match `clientName` if present
  - Execute deterministic Prisma query based on `queryType`
  - Return `{ type: "answer", text: "Kate had 8 sessions in March 2025." }`
- [ ] If `intent === "unknown"`: return `{ type: "answer", text: "I can log sessions (e.g. 'trained Kate today') or look up history (e.g. 'how many sessions did Kate have in March?')." }`

### `app/app/(app)/dashboard/DashboardClient.tsx` (new file)

- [ ] `ChatMessage` type: `{ role: "user" | "assistant"; content: string | LogConfirmPayload }`
- [ ] `LogConfirmPayload` type: `{ matches: MatchResult[]; date: string; unmatched: string[] }`
- [ ] `messages` state (`ChatMessage[]`, max 8, trimmed from top)
- [ ] `input` state + `loading` state
- [ ] `sendMessage()`: POST `/api/ai/chat`, append user message + assistant response to history
- [ ] `confirmLog(matches, date)`: call `logSession` server action, append success/error message to chat
- [ ] Render chat message list (assistant messages left, user messages right — minimal dark styling)
- [ ] Render `LogConfirmCard` inline for `log-confirm` responses: shows matched clients with sessions-remaining-after, unmatched names, Confirm/Cancel buttons
- [ ] Render single-line chat input at bottom with send button (Enter or click)
- [ ] Offline check in `confirmLog`: if `!navigator.onLine`, call `enqueueSession` instead

### `app/app/(app)/dashboard/page.tsx`

- [ ] Import and render `<DashboardClient clients={clients} />` above the stats sections
- [ ] Pass `clients` (fetched via existing Prisma query in the page) as a prop
- [ ] Remove the `<Link href="/sessions/new">Log today's sessions</Link>` button (replaced by chat)

---

## Data Flow Diagram

```
── IMPORT PATH ──────────────────────────────────────────────────

Coach uploads .xlsx/.csv with dates
       │
       ▼
parse-spreadsheet (AI route)
  ├─ col-A has dates? → handleSessionHistory()
  │      └─ Groq extracts (date, name, sessionNum, pkgSize, paid)[]
  │             └─ returns { format: "session-history", sessions: [...] }
  ├─ cells are Name X/Y? → handleSessionGrid()  (existing)
  │      └─ returns { format: "client-roster", clients: [...] }
  └─ else → handleRosterFormat()  (existing)
         └─ returns { format: "client-roster", clients: [...] }
       │
       ▼
Import page: confirm step
  ├─ session-history → POST /api/sessions/import
  │      ├─ upsert Session rows (keyed by clientId+dateKey)
  │      ├─ recalculate PackageEpisodes
  │      ├─ update Client flat totals
  │      └─ invalidate MonthlySummaryCache
  └─ client-roster → POST /api/clients/import  (existing)
       │
       ▼
/clients/[id] page
  └─ sessions grouped by month → "March 2025 (12 sessions)"

── UNIFIED CHAT PATH ────────────────────────────────────────────

Coach types anything in dashboard chat
       │
       ▼
POST /api/ai/chat
  ├─ Groq classifies: { intent: "log" | "query" | "unknown", ... }
  │
  ├─ intent === "log": "trained Kate and Marcus today"
  │    ├─ extract names: ["Kate", "Marcus"], date: today
  │    ├─ fuzzy-match → [Client(Kate), Client(Marcus)]
  │    └─ return { type: "log-confirm", matches, date, unmatched: [] }
  │         → DashboardClient shows confirm card
  │         → Coach taps Confirm
  │         → logSession(ids, date) server action
  │         → chat shows "2 sessions logged. Nice work!"
  │
  ├─ intent === "query": "how many sessions did Kate have in March?"
  │    ├─ extract: clientName="Kate", year=2025, month=3
  │    ├─ fuzzy-match "Kate" → Client record
  │    ├─ prisma.session.count({ where: { clientId, date ≥ Mar 1, < Apr 1 } }) → 8
  │    └─ return { type: "answer", text: "Kate had 8 sessions in March 2025." }
  │
  └─ intent === "unknown"
       └─ return { type: "answer", text: "I can log sessions or look up history…" }
       │
       ▼
DashboardClient chat thread
  └─ renders message cards inline on the homepage
```

---

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| AI misreads dates in unusual locale formats (DD/MM vs MM/DD) | Medium | Pass raw grid to Groq with explicit instructions; validate output dates with regex before accepting |
| Large spreadsheets (500+ sessions) hit Groq token limits | Low | Groq `llama-3.3-70b-versatile` handles ~128k tokens; 500 rows × 10 cells = ~5k tokens |
| Column A isn't always the date column | Medium | Fall back to existing format detection if `isSessionHistoryGrid` returns false |
| `sessions/import` `PackageEpisode` logic errors for clients with no `paid` sessions | Low | Existing handling already skips unpaid entries for episode detection |
| AI classifies log intent as query (or vice versa) | Low | Include clear examples in system prompt; log intents always contain a verb ("trained", "logged") |
| AI extracts wrong year when "March" is ambiguous (no year stated) | Medium | Include today's date in system prompt; default to most recent past occurrence of that month |
| Fuzzy match returns wrong client for similar names ("Kate" vs "Katie") | Low | Show matched name in the confirm card; coach can cancel and retype with full name |
| Chat feels slow (Groq round trip + Prisma) | Low | Groq intent classification is a tiny prompt (~100 tokens) — typically <500ms; Prisma count is indexed |
| Coaches who prefer the old explicit "Log sessions" page lose a familiar UI | Low | `/sessions/new` remains reachable from the nav "Log" tab; chat is additive, not a forced replacement |

---

## Sources & References

- `Session` model: `app/prisma/schema.prisma:82`
- `ParsedSessionEntry` type: `app/app/api/ai/parse-spreadsheet/route.ts:7`
- `/api/sessions/import` full pipeline: `app/app/api/sessions/import/route.ts`
- Per-client month-grouped history: `app/app/(app)/clients/[id]/page.tsx:38`
- Existing format detection (session-grid): `app/app/api/ai/parse-spreadsheet/route.ts:44`
- Monthly reports query: `app/app/api/reports/monthly/route.ts`
- Fuzzy match utility: `app/lib/fuzzy-match.ts`
- Groq client: `app/lib/groq.ts`
- Existing AI routes pattern: `app/app/api/ai/parse-session/route.ts`, `app/app/api/ai/monthly-summary/route.ts`
- Existing session logging: `app/app/actions/sessions.ts` (`logSession` server action)
- Existing offline queue: `app/lib/offline-queue.ts` (`enqueueSession`)
- Existing SessionLogger (AI quick-log, pattern reference): `app/app/(app)/sessions/new/SessionLogger.tsx:60`
- Dashboard server component (extends to add `DashboardClient`): `app/app/(app)/dashboard/page.tsx`
