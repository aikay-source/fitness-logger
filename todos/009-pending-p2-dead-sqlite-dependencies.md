---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, architecture, quality]
dependencies: []
---

# 009 — Dead SQLite dependencies still in package.json

## Problem Statement

After migrating to PostgreSQL, three packages remain as active dependencies with no imports in the codebase: `@prisma/adapter-better-sqlite3`, `better-sqlite3`, and `@types/better-sqlite3`. `better-sqlite3` is a native module that requires a compiled binary (~1–2 MB), increases install time, and can cause CI failures on Linux.

**Why it matters:** Unnecessary attack surface, slower installs, native binary compile step on CI.

## Findings

- `app/package.json` line 18: `"@prisma/adapter-better-sqlite3": "^7.5.0"` — unused
- `app/package.json` line 20: `"better-sqlite3": "^12.8.0"` — unused, listed in `dependencies` (not devDependencies)
- `app/package.json` devDependencies: `"@types/better-sqlite3"` — unused
- Zero imports of these packages anywhere in `app/` source tree
- `app/prisma/schema.prisma`: provider is `"postgresql"`, not `"sqlite"`

## Proposed Solutions

### Option A — Remove all three packages
```bash
cd app && npm uninstall @prisma/adapter-better-sqlite3 better-sqlite3 @types/better-sqlite3
```
- **Pros:** Clean, immediate
- **Cons:** None (confirmed unused)
- **Effort:** Trivial | **Risk:** None

## Recommended Action

Option A. Trivial, zero risk.

## Technical Details

- **Affected files:** `app/package.json`, `app/package-lock.json`
- **Note:** `next-themes` is also installed but unused (see separate todo if desired)

## Acceptance Criteria

- [ ] `@prisma/adapter-better-sqlite3` removed from package.json
- [ ] `better-sqlite3` removed from package.json
- [ ] `@types/better-sqlite3` removed from package.json
- [ ] `npm install` succeeds without native binary compilation
- [ ] App builds and runs normally after removal

## Work Log

- 2026-03-28: Found by all review agents
- 2026-03-28: CONFIRMED BREAKAGE in browser testing — `better-sqlite3` native binary was crashing the Turbopack compilation worker, causing Runtime Error on every DB interaction in dev
- 2026-03-28: Partial fix applied — `@prisma/adapter-better-sqlite3`, `better-sqlite3`, and `@types/better-sqlite3` removed from package.json and node_modules via `npm uninstall`. Dev server needs restart to take effect.

## Resources

- `app/package.json`
