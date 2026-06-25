# Axis Documentation Index

Status: ACTIVE

Purpose: Make the current source of truth easy to find and keep old docs from competing with it.

## Read First

Read in this order:

1. `README.md`
2. `docs/AXIS_PRODUCT_MAP.md`
3. `docs/AXIS_BUILD_MAP.md`
4. `docs/AXIS_DESIGN_CONSTITUTION.md`
5. `docs/AXIS_MOBILE_PRIORITY.md`
6. `docs/capsules/AXIS_SESSION_MEMORY.md`

## Current Product Truth

Axis is a basketball session memory system.

The first product win is:

```text
Open phone
-> sign in
-> start session
-> type / talk / tap moment
-> end session
-> memory exists
```

## Active Docs

| Doc | Status | What It Is For |
|---|---|---|
| `README.md` | ACTIVE | Short repo and product orientation. |
| `docs/AXIS_INDEX.md` | ACTIVE | The documentation front door. |
| `docs/AXIS_PRODUCT_MAP.md` | ACTIVE | What Axis is, who it serves, and the product decision test. |
| `docs/AXIS_BUILD_MAP.md` | ACTIVE | What may be built now and what is locked. |
| `docs/AXIS_DESIGN_CONSTITUTION.md` | ACTIVE | User-facing design rules and visual language. |
| `docs/AXIS_MOBILE_PRIORITY.md` | ACTIVE | Mobile-first gym-use rules. |
| `docs/AXIS_CURATION_GATE.md` | ACTIVE | Gate for deciding what can appear in a loop or on a page. |
| `docs/AXIS_DELIVERABLE_STANDARD.md` | ACTIVE | Standard for market-facing loop deliverables. |
| `docs/capsules/AXIS_AUTH.md` | ACTIVE | Auth and owner-scoped session save boundaries. |
| `docs/capsules/AXIS_SESSION_MEMORY.md` | ACTIVE | A1 session memory object, memory page, and build sequence. |
| `docs/capsules/AXIS_DATA_ASSET_LAYER.md` | ACTIVE FOUNDATION | Data asset vocabulary and future boundary. No runtime data asset operations. |

## Reference Docs

Reference docs are useful background, but they are not current build direction.

| Doc | What It Preserves |
|---|---|
| `docs/reference/AXIS_5W1H_PRODUCT_MAP.md` | Full 5W1H product framing merged into `AXIS_PRODUCT_MAP.md`. |
| `docs/reference/AXIS_UI_VISUAL_LANGUAGE.md` | Full UI language merged into design/mobile active docs. |
| `docs/reference/AXIS_A1_SESSION_OBJECT_CONTRACT.md` | Detailed session object contract merged into `AXIS_SESSION_MEMORY.md`. |
| `docs/reference/AXIS_MEMORY_PAGE_CONTRACT.md` | Detailed memory page contract merged into `AXIS_SESSION_MEMORY.md`. |
| `docs/reference/AXIS_A1_BUILD_SEQUENCE.md` | Detailed A1 sequence merged into build map and session memory capsule. |
| `docs/reference/AXIS_PRODUCT_COUNCIL.md` | Product council and decision checklist. |
| `docs/reference/AXIS_CONCEPT_INVENTORY.md` | Broad concept audit. |
| `docs/reference/AXIS_DUPLICATION_RISKS.md` | Overlap and naming-risk audit. |
| `docs/reference/AXIS_INDUSTRY_PROOF_MAP.md` | Industry pattern map. |
| `docs/reference/AXIS_CAPABILITY_INDEX.md` | Broad capability inventory. |
| `docs/reference/AXIS_VISUAL_LANGUAGE.md` | Older visual-token foundation. |
| `docs/reference/codebase-research.md` | Historical codebase research. |
| `docs/reference/repo-evaluation.md` | Historical repo evaluation. |

## Removed Legacy Docs

Old project markdown from prior directions has been removed from the working documentation set.

If a future build needs old context, recover it from git history instead of reintroducing archived docs as active guidance.

## What Not To Use As Current Build Direction

Do not use these as active build truth:

- removed legacy/archive docs
- thread-board/whiteboard-first docs
- capability indexes without checking the active build map
- lab mock docs
- future CV, board object, flywheel, cartridge, evidence, witness, memory, or monetization docs
- root historical agent docs unless they are explicitly refreshed to match this index

## Current Build Gate

The active product gate is A1 session memory:

```text
Start Session
-> capture typed/tap moment
-> show last interpreted moment
-> correct if needed
-> end session
-> saved/local memory exists
```

If a proposed feature does not strengthen that loop, it belongs in Tools, future docs, reference docs, or archive.
