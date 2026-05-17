# AXIS AGENT RULES

Before making product changes, read `/AXIS_CONSTITUTION.md`.

Axis is voice-linked behavioral replay.

The active product loop is:

Coach records clip -> coach speaks phrase -> player watches later -> behavior repeats.

Codex must:

- Preserve working auth, Supabase, upload, storage, replay, voice, and AI utility infrastructure.
- Make small scoped changes.
- Keep the frontend simple, fast, replay-focused, and consumer-friendly.
- Prioritize clips, behavior phrases, players, and watch-again moments.
- Keep AI invisible and assistive.
- Use basketball-first wording.
- Hide systems, constraints, phases, ontology, dashboards, analytics, and tactical structure unless explicitly requested.

Do not:

- Rebuild backend systems.
- Add dashboards.
- Add scouting analytics.
- Add basketball IQ scores.
- Add AI coaching claims.
- Add tactical software surfaces.
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
