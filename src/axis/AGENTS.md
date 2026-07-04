# Axis Core Agent Instructions

This folder owns the Axis capability architecture.

Do not build UI here. Do not create dashboards here. Do not add provider-specific product copy here.

## Product Rule

Axis adds capabilities, not screens.

Everything useful becomes structured memory.

```text
Input Source
-> Signal Adapter
-> Capability Run
-> AxisEvidence
-> AxisSessionObject
-> AxisMemoryPage
```

## Core Loop

```text
Start Session
-> Camera / type / talk / tap
-> Capture evidence
-> Interpret what happened
-> User corrects
-> Save memory
-> Review / export later
```

## Capability Discipline

- Add one capability at a time.
- Keep one Axis memory model.
- Keep one capability registry.
- Keep one update path.
- Do not add a route or screen for every SDK or API.
- Every capability run must declare what is real, uncertain, or placeholder.

## Output Rules

- Raw signals become `AxisEvidence`.
- Useful reads become `AxisSessionObject`.
- Searchable summaries become `AxisMemoryPage`.
- Do not promote guesses into memory without user review.

## Active Boundaries

- Local first.
- Supabase after local memory works.
- Proof export after evidence and memory work.
- Ask Axis only over saved Axis memory.
