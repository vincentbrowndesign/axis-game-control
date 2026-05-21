# AXIS CONTINUITY KERNEL

The Axis continuity kernel is the deterministic truth layer for basketball
memory reconstruction.

It exists beneath the shell and never presents itself as UI.

## Source Of Truth

Axis does not edit reality directly.

Axis stores immutable events. Current state is reconstructed from event
chronology.

The event log is canonical.

## STO

The State-Transition Operator is the deterministic memory kernel.

The LLM may interpret ambiguous human language, but STO enforces chronological
truth.

STO governs:

- Event sourcing.
- Chronology reconstruction.
- Rewind transitions.
- Correction handling.
- Replay anchor consistency.
- Static analytics.
- Contextual analytics.
- Continuity recalculation.

## Deterministic Rebuilds

Every current state must derive from replaying chronology.

Rebuild outputs include:

- Score.
- Possession.
- Player stat lines.
- Memory objects.
- Replay chronology.
- Continuity state.
- Static analytics.
- Contextual analytics.

## Rewind / Correction

Corrections are events.

Undo, replacement, and removal do not mutate prior facts directly. They append
correction events and trigger deterministic rebuild.

Examples:

- undo last
- actually 2
- wrong player
- remove turnover

## Sigma Propagation

Sigma propagation weights continuity significance across memory chronology.

Direction is assigned during graph construction. It is not inferred lazily during
propagation.

Kernel constants define directional asymmetry:

- Forward propagation.
- Backward propagation.
- Lateral propagation.
- Impedance weighting.

## Normalization

normalizeField is continuity stabilization, not cleanup.

It must:

- Preserve anchor grounding.
- Preserve sigma hierarchy.
- Prevent entropy inflation.
- Prevent double normalization.
- Preserve the minimum anchor sigma invariant.
- Return only SigmaMemoryPackage to runtime.

## Invariants

- Raw event chronology is canonical.
- Derived state is disposable and rebuildable.
- Raw sigma fields never enter runtime providers.
- SigmaMemoryPackage is runtime-safe.
- narrativeSeed values are canonical and typed.
- No free-form semantic strings become kernel vocabulary.

