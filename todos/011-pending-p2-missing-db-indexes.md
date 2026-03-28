---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, performance, database]
dependencies: []
---

# 011 — Missing composite indexes on Session and Client tables

## Problem Statement

Dashboard queries scan `Session` filtered by `coachId + date` and `Client` filtered by `coachId + active + sessionsRemaining` on every page load. With no supporting indexes beyond Prisma's auto-generated PKs, these become full table scans as data grows. At 50,000+ session rows they'll degrade noticeably.

**Why it matters:** Dashboard will slow down progressively as the user base grows. No migration needed now, but easy to add.

## Findings

- Dashboard: `Session.findMany WHERE coachId AND date >= ninetyDaysAgo` — no composite index on `(coachId, date)`
- Dashboard: `Session.findMany WHERE coachId AND date >= startOfMonth` — same
- Dashboard: `Client.findMany WHERE coachId AND sessionsRemaining <= 2 AND active = true` — no composite index
- `app/app/api/cron/daily-reminders/route.ts`: fetches ALL users with `reminderEnabled: true` then JS-filters by hour — no DB-level time filter, no index on `reminderTime`

## Proposed Solutions

### Option A — Add indexes to schema.prisma
```prisma
model Session {
  // ... existing fields ...
  @@index([coachId, date])
}

model Client {
  // ... existing fields ...
  @@index([coachId, active, sessionsRemaining])
}

model User {
  // ... existing fields ...
  @@index([reminderEnabled, reminderTime])
}
```
Run `prisma migrate dev --name add-performance-indexes`.
- **Effort:** Small | **Risk:** Low (indexes are additive, non-breaking)

### Option B — Fix daily-reminders cron to filter at DB level
```typescript
const currentHourPrefix = `${String(now.getUTCHours()).padStart(2, "0")}:`;
const matching = await prisma.user.findMany({
  where: {
    reminderEnabled: true,
    reminderTime: { startsWith: currentHourPrefix },
  },
  select: { id: true, name: true, reminderTime: true },
});
```
- **Effort:** Trivial | **Risk:** None

## Recommended Action

Both options. The index migration is safe and forward-looking. The cron fix is trivially correct.

## Technical Details

- **Affected files:** `app/prisma/schema.prisma`, `app/app/api/cron/daily-reminders/route.ts`

## Acceptance Criteria

- [ ] `@@index([coachId, date])` exists on `Session` model
- [ ] `@@index([coachId, active, sessionsRemaining])` exists on `Client` model
- [ ] Daily reminders cron filters by `reminderTime` in SQL, not JS
- [ ] Migration applied successfully

## Work Log

- 2026-03-28: Found by performance-oracle and architecture-strategist agents

## Resources

- `app/prisma/schema.prisma`
- `app/app/api/cron/daily-reminders/route.ts`
