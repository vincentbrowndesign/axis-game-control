---
name: axis-intelligence-layer
description: How to read, extend, and not break the Axis intelligence vocabulary layer — axis-core, witness-registry, experiment-registry, learning-engine
origin: Axis
tools: Read, Edit, Write, Grep, Glob
---

# Axis Intelligence Layer Skill

## When to Activate

When any task touches:
- `src/lib/axis-core.ts`
- `src/lib/witness-registry.ts`
- `src/lib/experiment-registry.ts`
- `src/lib/learning-engine.ts`

Or when a task requires a witness to produce a claim, an experiment to be registered, or the engine to evaluate an outcome.

## The Four Files

```
axis-core.ts          — frozen vocabulary. Zero imports. No behavior.
witness-registry.ts   — what can observe reality. canWitness() gate.
experiment-registry.ts — what can test reality. register/get/canRun.
learning-engine.ts    — Verdict accumulation → OutcomeSignal. No domain knowledge.
```

## Dependency Order

```
axis-core.ts
    ↓
witness-registry.ts    (imports axis-core)
    ↓
experiment-registry.ts (imports axis-core + witness-registry)
    ↓
learning-engine.ts     (imports axis-core only)
```

## Rules

**axis-core.ts is frozen.** Do not add types without explicit user approval. Every type here is shared vocabulary — changes ripple everywhere.

**learning-engine.ts must stay domain-agnostic.** If it references basketball, cameras, OpenAI, or any specific technology, the file is wrong. It only consumes `Verdict`, `WitnessEvent`, and `Claim` from axis-core.

**witness-registry.ts owns the canWitness gate.** New modalities go here. New dimensions go here per adapter. Coach wildcard (`["*"]`) means coach can witness any dimension.

**experiment-registry.ts owns canRun.** An experiment cannot run if no witness can observe its required dimensions. This is enforced by canRun() — do not bypass it.

## Adding a New Witness Dimension

1. Add to the relevant adapter in `witness-registry.ts`
2. No changes to `axis-core.ts` — WitnessDimension is an open string

## Adding a New Experiment

```typescript
import { register } from "../lib/experiment-registry";

register({
  id: "exp-eyes-up-01",
  constraint: "Eyes Up",
  hypothesis: "Athlete maintains gaze above waist level during dribble",
  dimensions: ["gaze"],
  duration_seconds: 90,
});
```

## Reading an Outcome

```typescript
import { record, observe, evaluate } from "../lib/learning-engine";

// When a witness fires:
record(witnessEvent);

// When the athlete speaks:
observe({ experiment_id, intent_id, text: "I kept looking down", timestamp });

// When the shell needs to know what's next:
const outcome = evaluate(experiment_id);
// outcome.signal: "continue" | "advance" | "refine" | "rest"
```

## What Not to Do

- Do not import from `witness-registry` inside `learning-engine`
- Do not add basketball-specific types to `axis-core`
- Do not add OpenAI or LLM calls inside any of these four files
- Do not parse `Observation.text` — presence is the signal, not content
