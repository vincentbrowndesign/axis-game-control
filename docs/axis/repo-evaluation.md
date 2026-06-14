# Repo Evaluation — Axis Integration

Evaluated against Axis architecture:
```
Intent → Expand → Understand → Experiment → Witness → Expand
```
Core files: axis-core.ts / witness-registry.ts / experiment-registry.ts / learning-engine.ts / development-graph.ts

---

## 1. What Should Be Copied Directly

### ECC — Session Hooks (SessionStart / SessionEnd)

ECC's `scripts/hooks/session-start.js` (724 lines) loads prior session context, injects ranked instincts and skills, detects project type, and bounds context at 8000 chars. `session-end.js` (333 lines) extracts transcript summary, captures last 10 user messages, 20 tools, 30 modified files.

**Axis steal:** Not the full 724-line script — the pattern. A `SessionStart` hook that prints Axis architectural boundaries at the start of every agent session. Prevents the three most common failures:
- Touching `axis-core.ts` without approval
- Adding domain knowledge to `learning-engine.ts`
- Rebuilding backend systems that aren't broken

**Copy directly:** Hook structure from `hooks/hooks.json`. Lifecycle categories: `PreToolUse`, `SessionStart`, `Stop`, `SessionEnd`. Already partially implemented in `.claude/settings.json`.

### Taste-Skill — Dial System (Adapted Already)

Three dials: `DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY`. Baseline 8/6/4 for generic UI. Axis dials are 2/1/8 — restrained, near-static, dense. The dial concept is the steal: a quantified vocabulary that prevents "beautiful generic" from drifting back in.

**Already copied:** `agents/axis/skills/taste/SKILL.md`

### Knowledge Work Plugins — plugin.json + SKILL.md Format

Manifest pattern: `{ name, version, description, skills[], context[] }`. Skills as auto-invoked Markdown. Commands as explicit slash triggers. Clean separation between what agents load automatically vs. what users invoke.

**Already copied:** `agents/axis/plugin.json`, `agents/axis/skills/*/SKILL.md`

---

## 2. What Should Be Adapted

### CodeGraph — Query Workflow for Agents

CodeGraph is installed and indexed (137 files, `.codegraph/codegraph.db`). Agents don't automatically know how to use it. Need a `SKILL.md` that teaches agents: when to reach for `codegraph query` instead of grep, what `--kind` flags mean, how to use `codegraph affected` for impact analysis before touching shared files.

**Adapt:** Create `agents/axis/skills/codegraph/SKILL.md`

### ECC — Memory Persistence (Lightweight Version)

ECC's full session persistence is 724+333 lines of Node.js. Axis doesn't need all of it — Claude Code's memory system already handles persistent context across sessions. The adaptation is a `SessionStart` hook that prints the Axis product loop + intelligence layer rules as a fast warm-up, and a `SessionEnd` no-op (memory handles the rest).

**Adapt:** Add `SessionStart` hook to `.claude/settings.json`

### Knowledge Work Plugins — .mcp.json for Axis Services

The `.mcp.json` pattern wires external tools via MCP servers. Axis has real services that would benefit: Supabase, Cloudflare Stream, Trigger.dev. None are wired yet. When Axis connects them via MCP, this is the format.

**Adapt:** Create `agents/axis/.mcp.json` as a placeholder with Axis service slots

### Taste-Skill — `/axis/mission` Specific Dials

The generic Taste-Skill covers all surfaces. `/axis/mission` has specific constraints: one-box layout, three-dot thinking indicator, thread message types, InputBox component. The taste skill should reference these concrete components, not just abstract dial values.

**Already adapted:** `agents/axis/skills/taste/SKILL.md` — could go deeper on component-specific rules

---

## 3. What Should Be Ignored

### Understand Anything — Dashboard

CodeGraph already covers agent-comprehension. Understand Anything adds a visual web dashboard (knowledge-graph.json + browser UI). For a solo founder with an already-indexed codebase, this is redundant surface. The Tree-sitter + LLM hybrid approach would also duplicate CodeGraph's static analysis.

**Ignore unless:** the visual graph becomes useful for onboarding a new contributor.

### ECC — Python LLM Core (`src/llm/`)

ECC's core engine is Python: `cli/`, `core/`, `prompt/`, `providers/`, `tools/`. Axis runs on Next.js with API routes. The LLM routing Axis needs is already in `src/app/api/axis/expand/route.ts` (gpt-4o-mini, temperature 0.25). No Python layer needed.

**Ignore:** Entire `src/llm/` structure

### ECC — 262 Skills, 64 Agents (Generic)

ECC ships skills for agent-eval, TDD, E2E testing, code review, build-fix, etc. These are general software engineering skills, not Axis-specific. Loading 262 skills into Axis context would dilute the Axis-specific rules. Axis has 4 skills — keep it that way until a real problem requires a new one.

**Ignore:** All ECC skills except the format/pattern they demonstrate

### ECC — Governance and Security Hooks

ECC has extensive bash dispatchers, quality gates, MCP health checks, console.log warnings, and format/typecheck hooks. Axis is a solo founder project. The engineering constitution already covers governance. Hooks should stay minimal.

**Ignore:** GateGuard, tmux integration, MCP health checks, verbose governance hooks

### PI (pi-ai/pi) — Doesn't Exist

404. Private or moved. Skip entirely until user provides a working URL.

---

## 4. Immediate Implementation Plan

**Priority 1 — Already done:**
- [x] CodeGraph installed and indexed (`.codegraph/codegraph.db`)
- [x] `.claude/settings.json` with PreToolUse hooks (build gate + core-freeze warning)
- [x] 4 SKILL.md files (intelligence-layer, build-check, product-gate, taste)
- [x] `agents/axis/plugin.json` manifest
- [x] `docs/axis/codebase-research.md`
- [x] `docs/axis/CARTRIDGE_TEMPLATE.md`

**Priority 2 — Implement now:**
- [ ] `SessionStart` hook in `.claude/settings.json` — warm Axis context at session open
- [ ] `agents/axis/skills/codegraph/SKILL.md` — teach agents to query the index
- [ ] `agents/axis/.mcp.json` — placeholder for Axis service MCP connections

**Priority 3 — When needed:**
- [ ] `src/lib/development-graph.ts` — the missing core file in the architecture
- [ ] `cartridges/basketball/` — first domain cartridge (dimensions + experiments)
- [ ] Expand `.mcp.json` with real Supabase/Cloudflare/Trigger.dev MCP server URLs

---

## 5. File-by-File Integration Strategy

| File | Source | Action | Status |
|------|--------|--------|--------|
| `.codegraph/codegraph.db` | CodeGraph | Generated, gitignored | Done |
| `.claude/settings.json` | ECC hooks pattern | Add SessionStart hook | Pending |
| `agents/axis/plugin.json` | Knowledge Work Plugins | Axis manifest | Done |
| `agents/axis/.mcp.json` | Knowledge Work Plugins | Placeholder, expand later | Pending |
| `agents/axis/skills/intelligence-layer/SKILL.md` | ECC SKILL.md format | Axis-specific | Done |
| `agents/axis/skills/build-check/SKILL.md` | ECC SKILL.md format | Axis-specific | Done |
| `agents/axis/skills/product-gate/SKILL.md` | ECC SKILL.md format | Axis-specific | Done |
| `agents/axis/skills/taste/SKILL.md` | Taste-Skill dials | Axis dials (2/1/8) | Done |
| `agents/axis/skills/codegraph/SKILL.md` | CodeGraph CLI | Teach query workflow | Pending |
| `docs/axis/codebase-research.md` | ECC research format | Axis file map | Done |
| `docs/axis/CARTRIDGE_TEMPLATE.md` | Knowledge Work Plugins | Cartridge pattern | Done |
| `docs/axis/repo-evaluation.md` | This document | Reference | Done |
| `src/lib/development-graph.ts` | Axis architecture | Missing core file | Not yet |
| `cartridges/basketball/` | Cartridge template | First domain plugin | Not yet |
