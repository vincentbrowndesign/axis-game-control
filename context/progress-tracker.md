# Progress Tracker

## Stabilized Verticals

IDENTITY

Status: done

- Clerk auth is installed and wired into the existing Axis app.
- Sign in, sign up, session persistence, and UserButton continuity support the identity seam.
- The auth pages act as the Axis front door: system entry first, check-in ritual after authentication.

PRESENCE

Status: in progress

- Frictionless V1 check-in is the active presence seam.
- Check In should prove daily return behavior before optional organization verification returns later.

HISTORY

Status: in progress

- Supabase persistence and streak summaries are the active history seam.
- Axis History accumulates check-ins, training logs, streaks, and sessions.
- Authenticated member home uses one ritual interaction: Check In.
- The large Check In typography is the action itself.
- Streak and last check-in are treated as archival save data.
- Check In now saves in place on the home surface instead of routing through separate ritual pages.
- Visible station/session-step progression is hidden for V1 so the post-check-in moment can stay focused on history, streak, and leaderboard continuity.
- Palette direction now favors living gym energy: warm charcoal surfaces, scoreboard amber, electric green, and active athletic participation over cold replay-era voids.
- V1 check-in no longer asks for browser location or blocks on gym-boundary verification; organization verification remains a future optional layer.
- Supabase schema audit completed; no destructive cleanup performed. Current data model should be stabilized around check-ins, history, leaderboard, and preserved future media foundations.
- Axis design system scaffold added so future screens inherit shared tokens, soft athletic surfaces, progression primitives, and the visual constitution instead of ad hoc styling.
- Athletic energy pass added a restrained live-gym signal rail, subtle activity meter, and recent-history pulse from real participation data without adding feeds or social mechanics.
- Visual history system added a streak calendar, accumulation grid, completed-day nodes, and active-day marker so history feels tangible without analytics UI.
- Sports rhythm pass grouped the check-in ritual with continuity anchor cards and a compact activity band so the interface has stronger athletic structure without dashboard clutter.

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
