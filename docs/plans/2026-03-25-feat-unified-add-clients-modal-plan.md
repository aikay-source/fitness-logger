---
title: "feat: Unified Add Clients Modal"
type: feat
status: completed
date: 2026-03-25
origin: docs/brainstorms/2026-03-25-client-upload-ux-brainstorm.md
---

# feat: Unified Add Clients Modal

## Overview

Replace the separate `/clients/new` form page and `/clients/import` page with a single "Add Clients" modal on the Clients list page. The modal has two tabs — **Single** (add one client at a time) and **Bulk** (CSV/Excel upload with preview and confirm). The modal stays open after each single-add to support rapid back-to-back onboarding; a "Done" button closes it and refreshes the list.

See brainstorm: `docs/brainstorms/2026-03-25-client-upload-ux-brainstorm.md`

---

## Problem Statement / Motivation

Coaches currently have two separate entry points for adding clients (a form page and an import page), forcing them to choose upfront. The single-add form captures `sessionsRemaining` as a direct field, which is unintuitive — coaches think in terms of "how many have they used," not "how many are left." The import flow is heavy (AI parsing, column mapping), and there is no simple CSV template to guide coaches on the expected format.

---

## Proposed Solution

One "Add Clients" button on the Clients list page triggers a modal with:

- **Single tab:** lean form — Name, Sessions Purchased, Sessions Used So Far, Unpaid Sessions (optional beyond Name). `sessionsRemaining` is derived on the client before sending to the API.
- **Bulk tab:** download template → upload CSV/Excel → auto-parse by column header → preview table with duplicate warnings → confirm import.

The old routes (`/clients/new`, `/clients/import`) redirect to `/clients`.

---

## Technical Considerations

- **Dialog and Tabs** are already implemented in `components/ui/dialog.tsx` and `components/ui/tabs.tsx` using `@base-ui/react`. No new dependencies needed.
- **CSV parsing** (`papaparse`, `xlsx`) and **CSV export** (`lib/export-csv.ts`) are already in the project.
- **Server component refresh**: the Clients list page is a server component. The modal calls `router.refresh()` only when "Done" is clicked (not per-submission) to avoid re-render flicker behind the open modal.
- **Duplicate detection** is client-side — the server component passes existing client names as a prop to the modal.
- **`POST /api/clients` bug fix**: the route currently ignores `unpaidSessions`. It must be updated to persist it (with the same guard used in the import route: only non-zero when `sessionsRemaining === 0`).
- **`sessionsUsed` field**: the UI captures "Sessions Used So Far." `sessionsRemaining = totalSessionsPurchased - sessionsUsed` is computed client-side before sending to either API endpoint. The DB schema and API signatures remain unchanged.
- **`DialogContent` width**: override the default `max-w-sm` to `max-w-lg` to accommodate the bulk preview table.

---

## Key Field Logic

```
// UI captures
name: string (required)
sessionsUsed: number (optional, defaults 0)
totalSessionsPurchased: number (optional, defaults 0)
unpaidSessions: number (optional, shown only when sessionsUsed >= totalSessionsPurchased)

// Derived before sending to API
sessionsRemaining = totalSessionsPurchased - sessionsUsed
// (clamped to 0 if negative — prevents invalid state)
```

---

## Acceptance Criteria

### Single Tab

- [x] Modal opens on Single tab when "Add Clients" button is clicked
- [x] Fields: Name (required), Sessions Purchased (optional), Sessions Used So Far (optional), Unpaid Sessions (optional, shown only when `sessionsUsed >= totalSessionsPurchased`)
- [x] Submitting with blank Name shows inline validation error; request is not sent
- [x] `sessionsRemaining = max(0, totalSessionsPurchased - sessionsUsed)` computed before `POST /api/clients`
- [x] On success: `toast.success("${name} added!")`, form clears, modal stays open
- [x] On API error: `toast.error(...)`, form not cleared, modal stays open
- [x] "Done" button calls `router.refresh()` then closes the modal
- [x] Pressing Escape or clicking the backdrop closes the modal (default dialog behaviour; no unsaved-data guard)

### Bulk Tab

- [x] "Download Template" button triggers download of `clients-template.csv` with headers: `Name,Sessions Bought,Sessions Used,Unpaid Sessions,Phone` (headers only, no sample row)
- [x] File upload accepts `.csv` and `.xlsx` only; other file types show an error message
- [x] Uploaded file is parsed using `papaparse` (CSV) or `xlsx` (Excel) with case-insensitive column header matching
- [x] Preview table shows: Name, Sessions Bought, Sessions Used, Unpaid Sessions, Phone; rows with no name are flagged as invalid and excluded from import
- [x] Rows whose `Name` already exists in the coach's client list are flagged with a yellow warning badge in the preview but remain included
- [x] Confirm button is disabled when 0 valid rows are present
- [x] On confirm: `sessionsRemaining` is derived per row before sending to `POST /api/clients/import`
- [x] On success: `toast.success("${imported} clients imported")`, modal closes, `router.refresh()` fires
- [x] On API error: `toast.error(...)`, preview remains visible (coach can retry)
- [x] Back button returns to file upload step

### List Page & Navigation

- [x] "Add Clients" button replaces the separate "Add" link and "Import" link in the header
- [x] Empty-state "Add your first client" CTA is a button that opens the modal (not a link to `/clients/new`)
- [x] `GET /clients/new` redirects to `/clients` (via `redirect()` in a server component or `next.config.js` redirect)
- [x] `GET /clients/import` redirects to `/clients`

### API Fix

- [x] `POST /api/clients` accepts and persists `unpaidSessions`
- [x] `unpaidSessions` is stored as 0 if `sessionsRemaining > 0` (same guard as the import route)

---

## System-Wide Impact

- **Interaction graph:** "Done" click → `router.refresh()` → Next.js re-fetches the server component → `prisma.client.findMany()` runs → updated client list renders. No callbacks or middleware affected.
- **API surface parity:** `POST /api/clients` and `POST /api/clients/import` both need to handle `sessionsRemaining` as a derived value (not user-entered). The import route already accepts it directly; the single-add route will now receive it computed from `sessionsUsed`.
- **State lifecycle risks:** The modal holds local form state. If the coach closes via Escape mid-form, state is lost — this is acceptable (matches existing page behaviour where navigating away loses form state).
- **Error propagation:** Both API errors and network failures surface via `toast.error` and leave the modal open so the coach can retry.

---

## Files to Change

| File | Change |
|------|--------|
| `app/(app)/clients/AddClientsModal.tsx` | **NEW** — unified modal with Single + Bulk tabs |
| `app/(app)/clients/page.tsx` | Replace Add/Import header links + fix empty-state CTA; pass client names to modal |
| `app/api/clients/route.ts` | Add `unpaidSessions` to POST handler with `sessionsRemaining === 0` guard |
| `app/(app)/clients/new/page.tsx` | Replace page content with `redirect("/clients")` |
| `app/(app)/clients/import/page.tsx` | Replace page content with `redirect("/clients")` |

---

## Implementation Notes

### `AddClientsModal.tsx` Skeleton

```tsx
// app/(app)/clients/AddClientsModal.tsx
"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { exportToCSV } from "@/lib/export-csv"

interface AddClientsModalProps {
  existingNames: string[]  // passed from server component for duplicate detection
}
```

### CSV Template Download

```ts
// Uses existing exportToCSV utility
exportToCSV(
  [{ Name: "", "Sessions Bought": "", "Sessions Used": "", "Unpaid Sessions": "", Phone: "" }],
  "clients-template.csv"
)
// Then immediately clear the dummy row from the download — headers only
// Alternative: pass an empty array and rely on PapaParse to output headers only
// Use: Papa.unparse({ fields: [...], data: [] }) for headers-only output
```

### Column Header Matching (Bulk Parse)

Reuse the existing `guessColumn` pattern from `app/(app)/clients/import/page.tsx:87–95`. Map: `name`, `sessions bought / totalSessionsPurchased`, `sessions used / sessionsUsed`, `unpaid sessions / unpaidSessions`, `phone`.

### Redirect Pages

```tsx
// app/(app)/clients/new/page.tsx
import { redirect } from "next/navigation"
export default function Page() {
  redirect("/clients")
}

// app/(app)/clients/import/page.tsx — same pattern
```

### API Fix (`POST /api/clients`)

```ts
// Add to destructured body:
const { name, phone, totalSessionsPurchased, sessionsRemaining, unpaidSessions } = await req.json()
// Add to prisma.client.create data:
unpaidSessions: sessionsRemaining === 0 ? (unpaidSessions ?? 0) : 0,
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| `@base-ui/react` Dialog/Tabs API differs from Radix (shadcn default) | Already confirmed — `DeleteAllButton.tsx` shows the `open`/`onOpenChange` pattern works. Use `DialogContent className="sm:max-w-lg"` to override default width. |
| Bulk preview table slow for very large files | Use `max-h-96 overflow-y-auto` (matches existing confirm UI). No virtualisation needed for typical coach roster sizes. |
| `importedCount` in API response is wrong (returns input length, not actual insert count) | Fix opportunistically in the same PR: use `result.count` from `prisma.client.createMany()`. |
| Existing bookmarks/redirects to `/clients/new` or `/clients/import` | Handled by server-side `redirect()` in the page components. |

---

## Success Metrics

- A coach can add a new client without leaving the Clients list page
- A coach can import a roster CSV in under 3 steps (upload → preview → confirm)
- Zero client data silently dropped (unpaidSessions persisted correctly)

---

## Sources & References

**Origin brainstorm:** [docs/brainstorms/2026-03-25-client-upload-ux-brainstorm.md](../brainstorms/2026-03-25-client-upload-ux-brainstorm.md)

Key decisions carried forward:
- Unified modal (Single + Bulk tabs) replaces separate pages
- "Sessions Used So Far" field (more natural than "Sessions Remaining")
- Modal stays open after single-add; "Done" closes + refreshes

**Internal references:**
- Existing Dialog usage: `app/(app)/clients/DeleteAllButton.tsx:46`
- Existing import flow: `app/(app)/clients/import/page.tsx`
- CSV export utility: `lib/export-csv.ts`
- API route to fix: `app/api/clients/route.ts:10`
- Import API: `app/api/clients/import/route.ts`
- Clients list server component: `app/(app)/clients/page.tsx`
