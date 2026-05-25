# Project Overview

Axis is AI-native sports media infrastructure for basketball game memory.

The current core loop is:

Upload Game -> Create Session -> Process Game -> Generate Replay -> Generate Clips -> Generate Stats -> Generate Broadcast -> Archive Game

Current unit:

Upload Game -> Saved Session -> Processing Job -> Complete

Goals:

- Persist every uploaded game as a real Axis session.
- Track backend processing state in real Supabase records.
- Trigger background processing through Trigger.dev.
- Generate placeholder output files only when they are stored in the real session/job structure.
- Keep the UI familiar, restrained, and upload-first.

Out of scope until the current seam is stable:

- Clips UI.
- Broadcast UI.
- Overlays.
- AI commentary.
- Roboflow/CV processing.
- New databases or storage systems.
