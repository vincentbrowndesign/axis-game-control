# AXIS AGENT RULES

Before making product changes, read `/AXIS_CONSTITUTION.md`.

Axis is AI-assisted coaching memory extraction for basketball.

The active product loop is:

Coach chooses a video -> Axis extracts candidate landmarks, timestamps, captions, and replay memory -> coach lightly reinforces meaningful moments -> players replay meaningful moments -> replay behavior helps the stream resurface what matters.

Codex must:

- Preserve working auth, Supabase, upload, storage, replay, voice, and AI utility infrastructure.
- Make small scoped changes.
- Keep the frontend simple, adaptive, upload-first, media-first, and lightweight.
- Prioritize Choose File, keyframes, landmarks, captions, replay, timestamps, Sessions, Players, coaching phrases, player mentions, and resurfacing.
- Keep AI invisible and assistive.
- Use basketball-first wording.
- Hide video-first UX, systems, constraints, phases, ontology, dashboards, analytics, and tactical structure unless explicitly requested.
- Preserve the Axis universal design chain: calm, operational, cinematic, embedded, spatial, structurally stable, low-friction, and inevitable.
- Use structural UI rather than floating overlay UI: top telemetry, center world/content, bottom interaction or memory rail.
- Keep the memory rail continuous and native: Enter submits, focus remains active, keyboard stays open, and duplicate submit mechanics stay out of the operator flow.
- Evolve UI gradually without restarting the visual language.

Do not:

- Rebuild backend systems.
- Add dashboards.
- Add scouting analytics.
- Add basketball IQ scores.
- Add AI coaching claims.
- Add AI assistant chat UI.
- Add tactical software surfaces.
- Add video breakdown software.
- Add manual clipping or timeline editing tools.
- Add startup, platform, neuroscience, or abstract product language.
- Add widget stacks, random floating cards, dashboard-heavy surfaces, loud gradients, or web-form-based primary interaction.

Every task must identify:

1. Goal.
2. Files changed.
3. What was intentionally not touched.
4. Verification run.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
