---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, quality, ui]
dependencies: []
---

# 010 — ThemeToggle FOUC bug + next-themes installed but unused

## Problem Statement

`ThemeToggle.tsx` initializes `dark` state as `true` unconditionally. Users who have `"light"` saved in localStorage will see their theme icons and any dark-mode-conditional styles render incorrectly for one React pass before the `useEffect` fires. Meanwhile, `next-themes` (which handles all of this) is installed but never used.

**Why it matters:** Visible flicker for light-mode users on every hard navigation. Dead dependency costs ~12KB.

## Findings

- `app/components/ThemeToggle.tsx` line 7: `const [dark, setDark] = useState(true)` — always assumes dark on first render
- The inline FWOT script in `layout.tsx` handles the document class correctly, but React's state is still wrong until `useEffect` runs
- `app/package.json`: `"next-themes": "^0.4.6"` — installed, never imported anywhere
- `app/app/layout.tsx` lines 63–67: manual FWOT script duplicates what `next-themes` would provide
- Two competing theme systems: custom `ThemeToggle` + inline script vs. unused `next-themes`

## Proposed Solutions

### Option A — Remove next-themes, fix FOUC in custom toggle (recommended if keeping custom impl)
Fix the initial state to avoid the flash:
```typescript
// Initialize from document class (already set by inline script before React hydrates)
const [dark, setDark] = useState(() => {
  if (typeof window === "undefined") return true; // SSR: default dark
  return document.documentElement.classList.contains("dark");
});
```
Then remove `next-themes` from package.json.
- **Pros:** Fixes the flicker; removes unused dependency
- **Effort:** Small | **Risk:** None

### Option B — Adopt next-themes properly
1. Wrap layout body in `<ThemeProvider attribute="class" defaultTheme="dark" storageKey="theme">`
2. Replace ThemeToggle internals with `const { theme, setTheme } = useTheme()`
3. Delete the inline `<script>` block from layout.tsx (next-themes handles FWOT itself)
4. Remove `suppressHydrationWarning`... wait, keep it — next-themes still needs it
- **Pros:** Library handles all edge cases; less custom code
- **Effort:** Small | **Risk:** Low

## Recommended Action

Option A is simpler given the custom implementation is already complete and working. The only actual bug is the initial state value — a one-line fix.

## Technical Details

- **Affected files:** `app/components/ThemeToggle.tsx`, `app/package.json`
- **Note:** The `suppressHydrationWarning` on `<html>` is correct in both options and should be kept

## Acceptance Criteria

- [ ] Light-mode users see no icon flicker on page load
- [ ] `useState` initial value matches the actual document theme class
- [ ] Either `next-themes` is used properly OR removed from package.json
- [ ] Both dark and light themes work correctly after the fix

## Work Log

- 2026-03-28: Found by typescript-reviewer, architecture-strategist, and simplicity-reviewer agents

## Resources

- `app/components/ThemeToggle.tsx`
- `app/app/layout.tsx` (lines 63–67)
