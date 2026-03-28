---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, typescript, quality]
dependencies: []
---

# 015 — TypeScript code quality: any types, hook suppressions, msgId counter

## Problem Statement

Several TypeScript quality issues accumulated: an `eslint-disable` suppressing a legitimate hook warning, a module-level mutable counter, `let body: any`, and a type-narrowing loss in a regex destructure.

## Findings

### 1. `let body: any` in PATCH route (eslint-disable)
`app/app/api/clients/[id]/route.ts` line 17:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let body: any;
```
Should be typed as a `ClientPatchBody` partial type:
```typescript
type ClientPatchBody = { name?: string; phone?: string | null; totalSessionsPurchased?: number; sessionsRemaining?: number; active?: boolean; unpaidSessions?: number; };
let body: ClientPatchBody;
```

### 2. Module-level mutable `msgId` counter in DashboardClient
`app/app/(app)/dashboard/DashboardClient.tsx` line 14: `let msgId = 0;`
Module-level mutable state in a React file. In strict mode double-renders this causes ID collisions. Replace with `useRef` inside the component.

### 3. `eslint-disable` suppressing `react-hooks/exhaustive-deps` in DashboardClient
Line 211: `}, []); // eslint-disable-line react-hooks/exhaustive-deps`
The intent is "fire once on mount". Correct pattern:
```typescript
const confettiFired = useRef(false);
useEffect(() => {
  if (response.type === "logged" && !confettiFired.current) {
    confettiFired.current = true;
    confetti(...);
  }
}, [response.type]);
```

### 4. `isoMatch.map(Number)` loses type narrowing
`app/app/api/ai/parse-spreadsheet/route.ts` line 81:
```typescript
const [, y, m, d] = isoMatch.map(Number); // y/m/d typed as number | undefined
```
Replace with:
```typescript
const [, yStr, mStr, dStr] = isoMatch;
const y = Number(yStr), m = Number(mStr), d = Number(dStr);
```

## Acceptance Criteria

- [ ] `let body: any` replaced with `ClientPatchBody` type in PATCH route
- [ ] `msgId` moved to `useRef` inside DashboardClient component
- [ ] `eslint-disable` comment removed from `AssistantBubble` useEffect
- [ ] `isoMatch.map(Number)` replaced with per-variable destructure

## Work Log

- 2026-03-28: Found by typescript-reviewer agent

## Resources

- `app/app/api/clients/[id]/route.ts` (line 17)
- `app/app/(app)/dashboard/DashboardClient.tsx` (lines 14, 211)
- `app/app/api/ai/parse-spreadsheet/route.ts` (line 81)
