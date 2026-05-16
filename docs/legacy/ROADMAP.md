# Roadmap

This roadmap describes direction without weakening current boundaries.

## Near Term

- Keep uploads stable and boring.
- Strengthen replay normalization for older session shapes.
- Improve replay recovery when signed URLs expire.
- Expand archive views using normalized session data.
- Preserve AXIS language and visual identity.

## Memory

- Make memory continuity more expressive after replay load.
- Improve player context across sessions.
- Store durable memory records in `axis_behavioral_memory` only after the replay/session boundary is stable.
- Keep memory independent from upload infrastructure.

## Inference

- Build replay-time inference from video signals.
- Add court, player, ball, and motion analysis after replay exists.
- Keep inference failure non-blocking for replay and upload.
- Do not place AI calls in `/api/upload`.

## Schema

- Add schema fields defensively.
- Keep `normalizeReplay` backward compatible.
- Support old local storage session objects.
- Prefer additive migrations over breaking shape changes.

## UI

- Preserve the AXIS black/lime/cyan replay system.
- Improve existing replay surfaces only when requested.
- Avoid redesigns without explicit instruction.
- Keep language focused on memory, replay, signal, context, and archive.

## Non-Goals

- Do not turn AXIS into a generic sports analytics dashboard.
- Do not make upload depend on inference.
- Do not mutate upload response shape.
- Do not break old sessions after schema changes.

