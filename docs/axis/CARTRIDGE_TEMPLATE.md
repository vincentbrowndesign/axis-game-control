# Axis Cartridge Template

A cartridge is a domain-specific plugin that extends the intelligence layer without modifying core vocabulary.

## What a Cartridge Owns

```
dimensions     — the WitnessDimension strings this domain uses
experiments    — the Experiment registrations for this domain
constraints    — what counts as satisfied in this domain
witnesses      — which modalities can observe which dimensions
```

A cartridge never touches:
- `axis-core.ts` — frozen vocabulary
- `learning-engine.ts` — domain-agnostic, must stay that way
- Another cartridge's dimensions

## Directory Structure

```
cartridges/
└── basketball/
    ├── cartridge.json          — manifest
    ├── dimensions.ts           — local WitnessDimension narrowing
    ├── experiments.ts          — register() calls
    └── SKILL.md                — agent instructions for this cartridge
```

## cartridge.json

```json
{
  "name": "basketball",
  "domain": "basketball",
  "version": "1.0.0",
  "dimensions": ["gaze", "spacing", "dribble_count", "footwork", "body_position"],
  "modalities": ["camera", "coach", "voice"]
}
```

## dimensions.ts

```typescript
// Narrow WitnessDimension locally — never edit axis-core.ts
import type { WitnessDimension } from "../../src/lib/axis-core";

export type BasketballDimension =
  | "gaze"
  | "spacing"
  | "dribble_count"
  | "footwork"
  | "body_position"
  | "contact"
  | "release_point";

// Satisfies WitnessDimension structurally — no cast needed
const _: WitnessDimension = "gaze" satisfies BasketballDimension;
```

## experiments.ts

```typescript
import { register } from "../../src/lib/experiment-registry";

register({
  id: "bball-eyes-up-01",
  constraint: "Eyes Up",
  hypothesis: "Athlete maintains gaze above waist level during dribble",
  dimensions: ["gaze"],
  duration_seconds: 90,
});

register({
  id: "bball-spacing-01",
  constraint: "Find The Corner",
  hypothesis: "Athlete reads corner player before driving",
  dimensions: ["gaze", "spacing"],
  duration_seconds: 60,
});
```

## Rules

- Cartridge dimensions are strings that satisfy `WitnessDimension` — no type edits to core
- Cartridge experiments use IDs namespaced to the domain (`bball-`, `music-`, etc.)
- Cartridge SKILL.md documents what a coding agent needs to know to extend it
- A cartridge failing does not crash the core loop — it just produces `"unobservable"` verdicts
