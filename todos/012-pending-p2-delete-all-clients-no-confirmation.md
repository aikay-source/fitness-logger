---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, security, quality]
dependencies: []
---

# 012 — DELETE /api/clients nukes all data with no confirmation token

## Problem Statement

`DELETE /api/clients` calls `prisma.client.deleteMany` for the entire coach's client list with no request body, no confirmation field, and no additional verification beyond the session cookie. An accidental double-click or a CSRF-adjacent attack (XSS on same domain, compromised browser extension) could wipe all client data irreversibly.

**Why it matters:** Irreversible bulk data loss with a single request. No recovery path.

## Findings

- `app/app/api/clients/route.ts` lines 50–58: `deleteMany WHERE coachId` with no request body
- The UI (`DeleteAllButton.tsx`) has a confirmation dialog, but the API itself accepts any authenticated DELETE
- No soft-delete path — data is permanently gone (though `active` flag exists and is used for `Client.findMany` filters)
- `SameSite=Lax` cookies (NextAuth default) block cross-site form submission but not same-site XSS

## Proposed Solutions

### Option A — Require confirmation field in request body
```typescript
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE_ALL") {
    return new NextResponse("Confirmation required", { status: 400 });
  }
  // ... proceed with deleteMany
}
```
Update the client-side `DeleteAllButton.tsx` to send `{ confirm: "DELETE_ALL" }` in the body.
- **Effort:** Small | **Risk:** None

### Option B — Soft delete (use existing active flag)
Instead of `deleteMany`, set `active: false` on all clients. Data is recoverable. The `findMany` queries already filter `active: true`.
- **Pros:** Recoverable; no data loss
- **Cons:** Clients still exist in DB; requires a "restore" flow or eventual hard delete
- **Effort:** Small | **Risk:** Low

## Recommended Action

Both: add confirmation body (Option A) AND change to soft delete (Option B). Together they require two deliberate steps to destroy data.

## Technical Details

- **Affected files:** `app/app/api/clients/route.ts`, `app/app/(app)/clients/DeleteAllButton.tsx`

## Acceptance Criteria

- [ ] `DELETE /api/clients` without `{ confirm: "DELETE_ALL" }` body returns 400
- [ ] DeleteAllButton sends the confirmation field
- [ ] Data is soft-deleted (active: false) rather than hard-deleted

## Work Log

- 2026-03-28: Found by security-sentinel agent

## Resources

- `app/app/api/clients/route.ts` (lines 50–58)
- `app/app/(app)/clients/DeleteAllButton.tsx`
