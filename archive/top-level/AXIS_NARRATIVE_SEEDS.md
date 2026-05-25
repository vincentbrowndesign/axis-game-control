# AXIS NARRATIVE SEEDS

narrativeSeed is the frozen semantic continuity vocabulary for Axis.

It bridges deterministic kernel output and runtime synthesis without allowing
free-form semantic drift.

## Law

narrativeSeed values are controlled, typed, enum-backed, runtime-safe, and
provider-safe.

Providers may consume narrativeSeed values.

Providers may not invent narrativeSeed values.

If a provider needs language outside the vocabulary, it returns suggestedLabel,
not narrativeSeed.

## Canonical Vocabulary

SCORING_RUN:

- scoring_run_start
- scoring_run_acceleration
- scoring_run_interruption
- unanswered_run
- run_stabilized

PRESSURE:

- pressure_escalation
- pressure_release
- pressure_sustained
- pressure_break

COLLAPSE:

- turnover_collapse
- late_clock_fragmentation
- possession_breakdown
- defensive_breakdown

STABILIZATION:

- stabilization_recovery
- rebound_interruption
- timeout_response
- possession_reset

TRANSITION:

- transition_pressure
- transition_rebound_chain
- transition_score
- outlet_sequence

PLAYER_IMPACT:

- player_stabilized_flow
- player_triggered_run
- player_interrupted_pressure
- player_sequence

SPATIAL_FUTURE:

- containment_break
- wing_action_chain
- paint_pressure
- corner_creation

NEUTRAL_UNKNOWN:

- routine_possession
- low_signal_event
- unresolved_sequence

## Type Contract

Runtime code must use:

- NARRATIVE_SEEDS.
- NarrativeSeed.
- isNarrativeSeed.
- assertNarrativeSeed.

MemorySliceRef.expectedSigmaProfile.dominantClusterSignatures must use
NarrativeSeed[].

SigmaMemoryPackage.narrativeSeeds must use NarrativeSeed[].

## Drift Prevention

Never accept:

- Arbitrary strings.
- LLM-generated labels.
- Provider-native semantic labels.
- UI copy as kernel vocabulary.

