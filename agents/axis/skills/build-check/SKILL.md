---
name: axis-build-check
description: Verify a clean TypeScript compile and Next.js build before committing or pushing any Axis changes
origin: Axis
tools: Bash
---

# Axis Build Check Skill

## When to Activate

Before every commit or push. After any edit to:
- `src/lib/` files
- `src/app/` files
- `src/types/` files
- `trigger/` files

## Commands

```bash
# Step 1 — type check only (fast, no output files)
npx tsc --noEmit

# Step 2 — full Next.js build
npm run build
```

Both must exit 0. If either fails, do not push.

## Reading Build Output

Next.js build output symbols:
```
○  static page    — correct for most Axis pages
λ  server render  — correct for API routes
●  ISR page       — expected for some dynamic pages
```

`/axis` should build as `○` (static). If it becomes `λ` unexpectedly, investigate before pushing.

## Common Failures

**Type errors in new lib files** — run `npx tsc --noEmit` first to isolate before running the full build.

**Missing imports** — check that axis-core, witness-registry, experiment-registry, and learning-engine imports use the correct relative path (`../lib/axis-core` not `@/lib/axis-core` unless path aliases are confirmed).

**API route runtime errors** — routes using `export const runtime = "nodejs"` must not import Edge-incompatible packages.

## What Not to Do

- Do not push without both checks passing
- Do not use `--no-verify` to bypass
- Do not ignore type errors as "just warnings" — Axis has zero-error standard
