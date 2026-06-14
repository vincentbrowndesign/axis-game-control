---
name: axis-codegraph
description: How to use the CodeGraph index to understand Axis faster — symbol lookup, dependency tracing, impact analysis — instead of repeated grep/read exploration
origin: CodeGraph (colbymchenry/codegraph)
tools: Bash
---

# Axis CodeGraph Skill

## When to Activate

Before exploring an unfamiliar file. Before changing a shared type or function. Before asking "where is X used?" Always try CodeGraph before grep or file reads.

## Index Location

```
.codegraph/codegraph.db   — SQLite, 137 files indexed
```

Regenerate if the index is stale:
```bash
codegraph index --force
```

## Core Commands

### Find a symbol by name
```bash
codegraph query "WitnessEvent" --json --limit 10
```
Returns: file path, line range, signature, docstring, whether it's exported.

### Find all symbols of a kind
```bash
codegraph query "canWitness" --kind function --json
codegraph query "Verdict" --kind type --json
codegraph query "record" --kind function --json
```

Kinds: `function`, `class`, `interface`, `type`, `constant`, `import`, `export`

### Trace what a file change would affect
```bash
codegraph affected src/lib/axis-core.ts --json
```
Use this before editing any shared file. If `affected` returns many files, the change is high-blast-radius.

### Full-text search within the index
```bash
codegraph query "experiment_id" --json --limit 20
```

## Key Symbols to Know

| Symbol | File | Kind |
|--------|------|------|
| `WitnessEvent` | `src/lib/axis-core.ts` | interface |
| `Verdict` | `src/lib/axis-core.ts` | type |
| `Claim` | `src/lib/axis-core.ts` | interface |
| `canWitness` | `src/lib/witness-registry.ts` | function |
| `register` | `src/lib/experiment-registry.ts` | function |
| `canRun` | `src/lib/experiment-registry.ts` | function |
| `record` | `src/lib/learning-engine.ts` | function |
| `observe` | `src/lib/learning-engine.ts` | function |
| `evaluate` | `src/lib/learning-engine.ts` | function |
| `analyzeIntent` | `src/lib/axis-expansion.ts` | function |
| `runExpansion` | `src/app/axis/mission/page.tsx` | function |

## When to Prefer CodeGraph Over Grep

| Task | Use |
|------|-----|
| Find where a symbol is defined | `codegraph query "name" --json` |
| Find all callers of a function | `codegraph query "name" --kind function` then check relationships |
| Understand blast radius of a change | `codegraph affected <file>` |
| Count how many files import from a module | `codegraph query "./axis-core" --kind import` |
| Find all exported interfaces | `codegraph query "" --kind interface --json` |
| Grep for a string pattern | Use Grep tool (CodeGraph doesn't do pattern matching) |

## Rules

- Run `codegraph affected src/lib/axis-core.ts` before any edit to core — it touches everything
- If `codegraph query` returns nothing, fall back to Grep
- The index does not auto-update — run `codegraph index` after significant file additions
