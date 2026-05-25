# Progress Tracker

## Stabilized Verticals

IDENTITY

Status: done

- Clerk auth is installed and wired into the existing Axis app.
- Sign in, sign up, session persistence, and UserButton continuity support the identity seam.
- The auth pages act as the Axis front door: system entry first, check-in ritual after authentication.

PRESENCE

Status: in progress

- Geofenced check-in is the active presence seam.
- Check In should prove a member physically showed up before history grows.

HISTORY

Status: in progress

- Supabase persistence and streak summaries are the active history seam.
- Axis History accumulates check-ins, training logs, streaks, and sessions.
- Authenticated member home uses one ritual interaction: Check In.
- The large Check In typography is the action itself.
- Streak and last check-in are treated as archival save data.

LEADERBOARD

Status: in progress

- The first social tension layer is live at `/leaderboard`.
- Rankings come only from verified check-ins and accumulated participation history.
- Categories track effort continuity: weekly hours, active streak, monthly consistency, and sessions completed.
- No talent, points, popularity, likes, comments, chat, or feed mechanics.

FUTURE LAYERS

Status: paused

- Media, commentary, feeds, vision, and analytics remain paused until identity, presence, and history stabilize.
- Future layers must inherit from the ritual continuity loop later.

## Current Active Loop

show up -> check in -> history grows -> return tomorrow
