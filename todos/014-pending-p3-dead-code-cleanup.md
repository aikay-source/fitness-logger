---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, quality, cleanup]
dependencies: ["009", "010"]
---

# 014 — Dead code and YAGNI cleanup (CSS, fonts, dependencies)

## Problem Statement

Several pieces of dead code accumulated during the PostgreSQL migration and theme work. These add maintenance burden and increase build/install overhead for no benefit.

## Findings

### 1. `next-themes` package unused
`app/package.json` line 30: `"next-themes": "^0.4.6"` — never imported anywhere. Remove after resolving todo #010.

### 2. Geist sans font loaded but never referenced
`app/app/layout.tsx` lines 6–10: `geistSans` is loaded and added to `<html>` className but `--font-geist-sans` CSS variable is never used. `body` uses `var(--font-instrument)`. One wasted font network request on cold load.

### 3. `@theme inline` CSS block has dead chart tokens
`app/app/globals.css` lines 7–49: The `@theme inline` block maps shadcn CSS variables to Tailwind `--color-*` utilities. No code uses `bg-card`, `text-primary`, `bg-chart-1`, etc. — all custom UI uses `var(--app-*)` inline. The 5 chart tokens (`--chart-1` through `--chart-5`) are pure scaffolding from `shadcn init`.

### 4. Stale SQLite comment in daily-reminders cron
`app/app/api/cron/daily-reminders/route.ts` line 16: `// SQLite LIKE query...` — the DB is PostgreSQL and no LIKE query is used.

### 5. `verifyCron` duplicated across cron routes
The `verifyCron` function likely appears in all 3 cron files. Extract to `app/lib/cron.ts`.

### 6. Duplicated client normalization in parse-spreadsheet
`app/app/api/ai/parse-spreadsheet/route.ts` lines 358–365 and 409–416 are character-for-character identical. Extract to a named function.

## Acceptance Criteria

- [ ] `next-themes` removed from package.json (after #010 resolved)
- [ ] `geistSans` font definition and variable removed from layout.tsx
- [ ] Chart CSS tokens removed from globals.css
- [ ] Stale SQLite comment removed from daily-reminders
- [ ] `verifyCron` extracted to shared lib/cron.ts
- [ ] Duplicated client normalization extracted to a named function

## Work Log

- 2026-03-28: Found by simplicity-reviewer and typescript-reviewer agents
