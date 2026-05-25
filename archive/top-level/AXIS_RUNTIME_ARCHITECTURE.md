# AXIS RUNTIME ARCHITECTURE

Axis is a deterministic memory runtime with an AI-native surface.

The surface remains one calm shell, one rail, and one state-driven viewport.
The runtime underneath owns chronology, continuity, retrieval, replay context,
and provider orchestration.

## Runtime Law

Axis owns system truth.

Providers are replaceable cognition nodes. They may interpret, synthesize, or
ground context, but they do not own memory, chronology, continuity, retrieval,
or replay truth.

## Runtime Boundary

All runtime reasoning must receive Axis-native context:

- Current state.
- Recent chronology.
- Static analytics.
- Contextual analytics.
- Retrieval intent.
- Replay references.
- Player context.
- SigmaMemoryPackage.

Providers must not receive raw sigma fields, mutable UI state, or provider-native
truth structures as the source of authority.

## Planner / Router / Runtime Separation

Planner determines:

- Provider role.
- Retrieval depth.
- Whether replay context is required.
- Whether chronology reconstruction is required.
- Whether external grounding is required.

Router handles:

- Provider selection.
- Explicit fallback behavior.
- Timeout fallback.
- Deterministic sequencing.
- Future multi-provider composition.

Runtime handles:

- Building RuntimeContext.
- Consuming SigmaMemoryPackage.
- Calling planner and router.
- Returning normalized Axis-native responses.
- Preserving continuity across requests.

## SigmaMemoryPackage Boundary

SigmaMemoryPackage is the only runtime-safe continuity surface.

It may expose:

- Ranked memory ids.
- Normalized sigma anchors.
- Continuity clusters.
- Canonical narrativeSeed values.
- Replay and chronology references.

It must not expose:

- Raw propagation fields.
- Unnormalized sigma values.
- Free-form semantic labels.
- Provider-invented continuity categories.

## Runtime Contracts

AxisAgentRequest must normalize every provider call into Axis language.

AxisAgentResponse must normalize every provider result back into Axis language.

Provider-native objects do not cross the runtime boundary.

## Surface Rule

No provider routing, runtime state, planner traces, or orchestration machinery is
shown in the product surface.

The user experiences one intelligence surface.

