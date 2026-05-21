# AXIS ORCHESTRATION RUNTIME

Axis orchestration coordinates cognition providers without surrendering system
truth.

The orchestration layer is deterministic, explicit, and invisible.

## Provider Roles

OpenAI:

- Runtime contextual synthesis.
- Memory-aware language interpretation.
- Natural response shaping from Axis context.

DeepSeek:

- Low-cost reasoning.
- Code critique.
- Structured secondary analysis.

Perplexity:

- External research.
- Citations.
- World grounding when current outside context is required.

Deepgram and MediaPipe are planned perception providers. They do not own memory
truth.

## Provider Law

Providers may consume Axis-native requests.

Providers may return normalized Axis-native responses.

Providers may not:

- Own chronology.
- Own continuity.
- Invent narrativeSeed values.
- Return provider-native objects directly to runtime.
- Override STO truth.

## Routing Laws

Planner decides intent and routing.

Router executes explicit provider selection and fallback.

Runtime preserves continuity and returns normalized output.

Routing remains deterministic until autonomous behavior is explicitly introduced.

## Provenance Rules

Every provider response must preserve:

- Provider name.
- Provider role.
- Confidence.
- Latency.
- Citations when applicable.
- Continuity references.
- Memory references.

Provider uncertainty must not overwrite deterministic kernel state.

## Contract Boundary

All providers route through:

- AxisAgentRequest.
- AxisAgentResponse.
- RuntimeContext.
- ProviderAdapter.
- SigmaMemoryPackage.

This keeps providers interchangeable and prevents provider-specific drift.

