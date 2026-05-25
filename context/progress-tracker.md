# Progress Tracker

## Stabilized Verticals

IDENTITY

Status: done

- Clerk auth is installed and wired into the existing Axis app.
- Sign in, sign up, session persistence, and UserButton continuity are the active identity seam.

PRESENCE

Status: in progress

- Geofenced check-in is the active presence seam.
- Check-in should prove that a member physically showed up before history grows.

HISTORY

Status: in progress

- Supabase persistence and streak summaries are the active history seam.
- Axis History should accumulate check-ins, training logs, streaks, sessions, and future replay history.

REPLAY

Status: paused

- Replay remains future infrastructure until identity, presence, and history stabilize.
- Replay, clips, AI, and broadcasts must build on top of persistent presence continuity later.
