---
title: "feat: AI Bulk Import with Editable Preview"
type: feat
status: completed
date: 2026-03-25
origin: docs/brainstorms/2026-03-25-ai-bulk-import-parsing-brainstorm.md
---

# feat: AI Bulk Import with Editable Preview

## Overview

Replace the column-header matching in the Bulk tab of `AddClientsModal` with AI-powered parsing. Coaches can upload any file structure — the AI extracts name, sessions bought, sessions used, unpaid sessions — and the result is shown in an editable preview table before import is confirmed.

See brainstorm: `docs/brainstorms/2026-03-25-ai-bulk-import-parsing-brainstorm.md`

---

## Problem Statement / Motivation

The current Bulk tab uses `guessColumn`/`parseGrid` — column-header matching that only works when headers resemble the expected names. Coaches who track clients in custom spreadsheet layouts (session-history grids, attendance logs, etc.) get zero data or garbage output. AI parsing removes this brittleness entirely.

---

## Proposed Solution

When a coach uploads a file in the Bulk tab:
1. File is parsed to `string[][]` client-side (papaparse / xlsx)
2. A spinner replaces the upload zone while the AI call runs
3. `POST /api/ai/parse-spreadsheet` returns `client-roster`, `session-history`, or `unknown`
4. The result is mapped to `BulkRow[]` and displayed in an **editable** preview table
5. Coach corrects any misread values, then confirms import

The `guessColumn` + `parseGrid` functions are removed. The existing AI route is unchanged.

---

## Technical Considerations

### Bulk tab state machine

New state value `"parsing"` is added between `"upload"` and `"preview"`:

```
"upload" → (file dropped) → "parsing" → (AI success) → "preview"
                                       → (AI unknown/error) → "error"
```

`"error"` is a new state (separate from `fileError` string) that shows an explanatory message and a Back button returning to `"upload"`.

### Mapping AI response → BulkRow

**`client-roster` format:**
```ts
// AI returns: { name, totalSessionsPurchased, sessionsRemaining, unpaidSessions }
// BulkRow stores sessionsUsed, not sessionsRemaining
sessionsUsed = totalSessionsPurchased - sessionsRemaining  // reverse-derive
```

**`session-history` format** (aggregate `ParsedSessionEntry[]` per client):
```ts
sessionsUsed    = count of all entries for that client
unpaidSessions  = count of entries where paid === false
totalSessionsPurchased = packageSize if all entries for the client share
                         the same non-null packageSize, else 0 (editable by coach)
```

**On confirm** (both formats): always recompute `sessionsRemaining = Math.max(0, totalSessionsPurchased - sessionsUsed)`.

### Inline editing

Each `BulkRow` lives in `parsedRows` state. A single updater:

```ts
function updateRow(i: number, field: keyof BulkRow, raw: string) {
  setParsedRows(prev => prev.map((r, idx) => {
    if (idx !== i) return r;
    const updated = { ...r, [field]: field === "name" ? raw : Math.max(0, Number(raw) || 0) };
    // Re-derive valid + isDuplicate on every name change
    if (field === "name") {
      updated.valid = raw.trim().length > 0;
      updated.isDuplicate = existingNamesLower.includes(raw.trim().toLowerCase());
    }
    return updated;
  }));
}
```

Cells use `<input>` elements (not contentEditable) consistent with `ClientDetailClient.tsx` pattern. Name: `type="text"`. Numbers: `type="number" min="0"`.

### Row limit guard

Before calling the AI, truncate to the first 200 rows if the grid exceeds this. Show a dismissable notice: "Only the first 200 rows were sent to the AI."

### Phone field

Phone is silently dropped — the AI parse-spreadsheet route does not return it in `client-roster` format. Not a regression for new imports; only affects coaches who previously used the column-matching path with a phone column.

---

## Key Field Logic (unchanged from unified modal plan)

```
Preview captures: name, totalSessionsPurchased, sessionsUsed, unpaidSessions
On confirm: sessionsRemaining = Math.max(0, totalSessionsPurchased - sessionsUsed)
unpaidSessions guard applied server-side (kept to 0 if sessionsRemaining > 0)
```

---

## Files to Change

| File | Change |
|------|--------|
| `app/(app)/clients/AddClientsModal.tsx` | Replace guessColumn/parseGrid with AI call; add "parsing"/"error" states; make preview cells editable |

No API or schema changes required.

---

## Acceptance Criteria

### Upload + AI Parsing

- [x] File is parsed client-side to `string[][]` (existing logic unchanged)
- [x] If grid exceeds 200 rows, truncate to 200 and show notice "Only the first 200 rows were analysed"
- [x] After file selection, `bulkStep` transitions to `"parsing"`; upload zone is replaced with a spinner and "Analysing your file…"
- [x] `POST /api/ai/parse-spreadsheet` is called with `{ rawData: truncatedGrid }`
- [x] On `format: "unknown"`, transition to `"error"` state showing the AI's error message and a Back button
- [x] On fetch/network error, also transition to `"error"` state with a generic message
- [x] On `format: "client-roster"`, map to `BulkRow[]` using `sessionsUsed = totalSessionsPurchased - sessionsRemaining`
- [x] On `format: "session-history"`, aggregate `ParsedSessionEntry[]` per client (sessionsUsed = entry count, unpaidSessions = unpaid entry count, totalSessionsPurchased = shared packageSize or 0)
- [x] Duplicate names are flagged (cross-checked against `existingNames` prop)

### Editable Preview Table

- [x] Name column: `<input type="text">` — changes update `valid` and `isDuplicate` in real time
- [x] Bought, Used, Unpaid columns: `<input type="number" min="0">` — changes clamp to non-negative integers
- [x] A row with an empty Name cell shows a red `invalid` badge and is excluded from the import count
- [x] A row where `sessionsUsed > totalSessionsPurchased` shows a yellow `check values` badge (informational — import still proceeds with `sessionsRemaining` clamped to 0)
- [x] Duplicate rows retain a yellow `duplicate` badge; they remain in the valid count and are imported
- [x] Confirm button disabled when valid row count is 0

### State Transitions

- [x] Back button in `"error"` state returns to `"upload"` step and clears file input
- [x] Back button in `"preview"` state returns to `"upload"` step and clears rows + file input
- [x] Closing the modal resets all bulk state including `"parsing"` and `"error"` states

### Removals

- [x] `guessColumn` function removed from `AddClientsModal.tsx`
- [x] `parseGrid` function removed from `AddClientsModal.tsx`
- [x] `handleParsedFile` refactored to call the AI route instead of `parseGrid`

---

## System-Wide Impact

- **Interaction graph:** File upload → client-side parse → `POST /api/ai/parse-spreadsheet` (Groq/Llama, ~1–3s) → state update → editable table renders. On confirm → `POST /api/clients/import` → `prisma.client.createMany`. No callbacks or observers affected.
- **Error propagation:** Groq failures surface as `format: "unknown"` (from the existing route's catch block) or as a `fetch` error (network down). Both are caught client-side and transition to `"error"` state with `toast` feedback.
- **State lifecycle:** No server state is mutated until the coach confirms. The AI call is read-only. If the modal is closed mid-parse, the in-flight fetch completes server-side (no side effects) and the result is discarded.
- **API surface parity:** The `/api/ai/parse-spreadsheet` route is already used by the session logger. This plan adds a second caller but does not modify the route.

---

## Implementation Notes

### `AddClientsModal.tsx` sketch (Bulk tab changes only)

```tsx
// New state values
type BulkStep = "upload" | "parsing" | "preview" | "error";
const [bulkStep, setBulkStep] = useState<BulkStep>("upload");
const [parseError, setParseError] = useState<string | null>(null);

// Remove: guessColumn, parseGrid, handleParsedFile
// Add: aggregateSessionHistory, mapRosterToRows, handleFileWithAI

async function handleFileWithAI(file: File) {
  // 1. Parse to string[][] (existing papaparse/xlsx logic)
  // 2. Truncate if > 200 rows
  // 3. setBulkStep("parsing")
  // 4. POST /api/ai/parse-spreadsheet
  // 5. Map response to BulkRow[] (roster or session-history)
  // 6. setParsedRows + setBulkStep("preview") || setBulkStep("error")
}

function aggregateSessionHistory(sessions: ParsedSessionEntry[]): BulkRow[] {
  const byName = new Map<string, { count: number; unpaid: number; packageSizes: Set<number> }>();
  for (const s of sessions) {
    const e = byName.get(s.name) ?? { count: 0, unpaid: 0, packageSizes: new Set() };
    e.count++;
    if (!s.paid) e.unpaid++;
    if (s.packageSize !== null) e.packageSizes.add(s.packageSize);
    byName.set(s.name, e);
  }
  return [...byName.entries()].map(([name, e]) => {
    const packageSize = e.packageSizes.size === 1 ? [...e.packageSizes][0] : 0;
    const isDuplicate = existingNamesLower.includes(name.toLowerCase().trim());
    return { name, totalSessionsPurchased: packageSize, sessionsUsed: e.count, unpaidSessions: e.unpaid, phone: "", valid: true, isDuplicate };
  });
}

function mapRosterToRows(clients: AiRosterClient[]): BulkRow[] {
  return clients.map((c) => ({
    name: c.name,
    totalSessionsPurchased: c.totalSessionsPurchased,
    sessionsUsed: Math.max(0, c.totalSessionsPurchased - c.sessionsRemaining),
    unpaidSessions: c.unpaidSessions,
    phone: "",
    valid: c.name.trim().length > 0,
    isDuplicate: existingNamesLower.includes(c.name.trim().toLowerCase()),
  }));
}

// Editable cell in preview table
<input
  type="text"
  value={row.name}
  onChange={(e) => updateRow(i, "name", e.target.value)}
  className="w-full bg-transparent text-[#f2f1ed] focus:outline-none focus:border-b focus:border-[#a3a29f]"
/>
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Groq context window exceeded for large files | 200-row client-side truncation with user notice |
| AI misreads session-history with unusual date formats | Existing `normalizeDateToISO` utility in the route handles this before the AI prompt |
| `sessionsUsed` displayed incorrectly from client-roster (reverse-derived) | Editable — coach can correct inline |
| In-flight AI request when modal is closed | No side effects; result is simply discarded |

---

## Sources & References

**Origin brainstorm:** [docs/brainstorms/2026-03-25-ai-bulk-import-parsing-brainstorm.md](../brainstorms/2026-03-25-ai-bulk-import-parsing-brainstorm.md)

Key decisions carried forward:
- AI replaces column-matching entirely (no fallback)
- Spinner + "Analysing your file…" loading state
- Inline cell editing (controlled inputs per cell)
- Error + retry on unknown format

**Internal references:**
- AI parse route: `app/api/ai/parse-spreadsheet/route.ts`
- AddClientsModal (Bulk tab): `app/(app)/clients/AddClientsModal.tsx:33–270`
- Inline editing pattern: `app/(app)/clients/[id]/ClientDetailClient.tsx:100`
- Groq client: `lib/groq.ts`
