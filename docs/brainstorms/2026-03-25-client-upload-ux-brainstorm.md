---
date: 2026-03-25
topic: client-upload-ux
---

# Client Upload UX

## What We're Building

A unified "Add Clients" modal accessible from the clients list page. The modal has two tabs — **Single** and **Bulk** — so coaches can add one client at a time or upload a full roster from a CSV/Excel file. Both flows capture the same minimal set of fields. No historic session data is required; the system tracks everything from the moment the client is added.

## Why This Approach

Three approaches were considered:

- **Unified modal (chosen):** One entry point, toggle between single and bulk. Keeps mental model simple and ensures both flows use the same field structure.
- **Inline table row:** Fast but complex on mobile and harder to implement with validation.
- **Separate pages (current pattern):** Simple but two entry points means coaches have to decide upfront and navigate between routes.

The unified modal wins on simplicity and consistency while supporting both use cases equally well.

## Key Decisions

- **Fields to collect:** Name (required), Sessions Purchased, Sessions Used So Far, Unpaid Sessions (all optional beyond name). Phone is not collected. Sessions Remaining is derived: `sessionsRemaining = sessionsPurchased - sessionsUsed`.
- **No historic data:** The system does not ask for or import past session logs. Tracking begins from the upload date.
- **Single tab:** A clean form — one field per row, inline validation, "Add Client" button. Modal stays open and clears the form after each add; a "Done" button closes it. Enables rapid back-to-back onboarding.
- **Bulk tab:** Download template → upload CSV/Excel → auto-parse → preview table (name, purchased, used, unpaid) → confirm import. Duplicate names are flagged in the preview but the coach decides whether to import them. Template columns match the single form exactly.
- **Entry point:** "Add Clients" button on the Clients list page only. No dashboard shortcut.
- **Replace existing flows:** This modal replaces `/clients/new` and `/clients/import`. Both routes redirect to the clients list page.
- **Sessions used is the capture pattern:** Rather than asking for sessions remaining directly, we ask how many have been used. This is more natural when onboarding ("they've done 3 of their 10 sessions") and prevents off-by-one errors.

## Open Questions

None.

## Next Steps

→ `/ce:plan` for implementation details
