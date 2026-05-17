# AXIS AGENT RULES

Before making product changes, read `/AXIS_CONSTITUTION.md`.

Axis is multimodal behavioral reinforcement memory.

The active product loop is:

Coach taps Record -> coach taps Landmark on a meaningful moment -> coach speaks naturally -> Axis synchronizes voice, captions, timestamps, and surrounding context -> players replay meaningful moments later.

Codex must:

- Preserve working auth, Supabase, upload, storage, replay, voice, and AI utility infrastructure.
- Make small scoped changes.
- Keep the frontend simple, fast, media-first, and lightweight.
- Prioritize Record, Landmark, playback, captions, timestamps, Sessions, Players, coaching phrases, and player mentions.
- Keep AI invisible and assistive.
- Use basketball-first wording.
- Hide video-first UX, systems, constraints, phases, ontology, dashboards, analytics, and tactical structure unless explicitly requested.

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

Every task must identify:

1. Goal.
2. Files changed.
3. What was intentionally not touched.
4. Verification run.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
