---
date: 2026-03-25
topic: ai-bulk-import-parsing
---

# AI-Powered Bulk Import Parsing

## What We're Building

Replace the current column-header matching in the Bulk tab of the Add Clients modal with AI parsing. When a coach uploads any file — no matter the column names, layout, or formatting quirks — the AI analyses it and extracts: **name, sessions bought, sessions used, unpaid sessions**. The result is shown in an editable preview table where coaches can fix any misread values inline before confirming the import.

## Why This Approach

Three approaches were considered:

- **AI replaces column-matching (chosen):** Simpler coach experience. Upload anything, AI handles interpretation. The existing `/api/ai/parse-spreadsheet` route already handles multiple formats.
- **AI as fallback only:** Would keep two code paths alive and add branching logic for minimal benefit.
- **Coach chooses AI vs manual:** Adds UI complexity and decision fatigue. YAGNI.

AI-only wins on simplicity and matches the goal of handling "tricky structures."

## Key Decisions

- **AI route:** Use the existing `POST /api/ai/parse-spreadsheet` which accepts `{ rawData: string[][] }` and returns `client-roster`, `session-history`, or `unknown` format.
- **Loading state:** While AI is parsing, show a spinner with "Analysing your file…" replacing the upload area. No disabled states — full feedback.
- **AI failure (`unknown` format):** Show an error message explaining the file couldn't be understood, plus a button to upload a different file. No fallback to column-matching.
- **Editable preview:** After AI parses, show a table where every cell (Name, Bought, Used, Unpaid) is directly editable inline. Coach fixes errors before confirming.
- **Session-history format handling:** If the AI returns session-history (an attendance log), aggregate to client level: `sessionsUsed = sessionCount`, `unpaidSessions = unpaidCount`, `totalSessionsPurchased = blank (editable)`. This is a natural fit since attendance logs don't record package sizes — coach fills those in.
- **Duplicate detection:** Preserved from current Bulk tab. After AI parses, names are cross-checked against existing clients and flagged with a warning badge in the preview table.
- **The column-matching (`guessColumn`) logic is removed** from `AddClientsModal.tsx` — fully replaced.

## Flow

```
Upload file
    ↓
Parse to string[][] (papaparse / xlsx)
    ↓
POST /api/ai/parse-spreadsheet
    ↓
format = "unknown"         → show error + retry button
format = "client-roster"   → map directly to preview rows
format = "session-history" → aggregate to per-client rows (used/unpaid known, bought blank)
    ↓
Show editable preview table (inline cell editing)
    ↓
Coach edits/confirms → derive sessionsRemaining = purchased - used → POST /api/clients/import
```

## Open Questions

None.

## Next Steps

→ `/ce:plan` for implementation details
