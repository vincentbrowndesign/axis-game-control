# AXIS Agent Rules

Read these docs before changing code:

- `docs/ARCHITECTURE.md`
- `docs/UPLOAD_PIPELINE.md`
- `docs/REPLAY_SCHEMA.md`
- `docs/MEMORY_SYSTEM.md`
- `docs/INFERENCE_LAYER.md`
- `docs/UI_LANGUAGE.md`
- `docs/AXIS_IDENTITY.md`
- `docs/CODING_RULES.md`
- `docs/KNOWN_ISSUES.md`
- `docs/ROADMAP.md`

Hard rules:

- Uploads are stable infrastructure. Do not mutate upload response shape.
- Uploads should never know about AI, inference, memory, or analysis.
- Memory and inference happen after replay loads.
- Normalize all replay/session data before render.
- Old sessions must never break after schema changes.
- Preserve AXIS visual identity and language.
- Do not redesign UI unless explicitly asked.

Forbidden AXIS labels:

- CONTROL LOST
- PRESSURE SPIKE
- RUN DETECTED
- RECOVERY WINDOW

Preferred AXIS labels:

- Memory Online
- Context Building
- Replay Linked
- Footage Accepted
- Memory Stored

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
