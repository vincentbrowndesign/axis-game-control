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
- Rhythm/progression refinement strengthened active-day treatment, softened future days, added a directional continuity line, and quieted ritual subcopy into metadata.
- Real continuity modules replaced placeholder side cards with a streak ring, mini history grid, rank object, and active-today participation count from check-in data.
- Progression grid now extends into softer future days and marks the next accumulation node, making streak direction and momentum easier to read visually.
- Home surface now scrolls from the top on desktop to prevent clipped content, and the design pattern is anchored to a concrete member-profile/activity-template.
- Light surface athletic pass moved the member home away from heavy cinematic darkness toward warm concrete, soft graphite, daylight gym energy, and calmer active signals.
- Glow refinement compressed broad haze into sharper signal edges, shorter shadows, and more readable athletic typography.
- Athletic rhythm pass added a compact ritual momentum strip, more tactile completed-day states, stronger active-day emphasis, and clearer progression surfaces without adding new features.
- Template acceleration pass made structural rhythm more reusable: top records became soft modules, the activity rail became a contained participation band, and continuity/history surfaces gained clearer grouped cadence.
- Semantic clarity pass reorganized member-home hierarchy around the first question, "Did I show up today?", then grouped support systems into Today, This Week, This Month, and All Time.
- Progression language pass unified continuity visuals around rounded square tiles so history, streaks, weekly activity, active days, and progression grids feel like one system.
- History and leaderboard refinement made the calendar the primary continuity object, softened the checked-in hero, and gave rank labels concrete meaning such as most active, longest streak, month, and sessions.

LEADERBOARD

Status: in progress

- The first social tension layer is live at `/leaderboard`.
- Rankings come only from verified check-ins and accumulated participation history.
- Categories track effort continuity: weekly hours, active streak, monthly consistency, and sessions completed.
- No talent, points, popularity, likes, comments, chat, or feed mechanics.

ORGANIZATIONS

Status: foundation

- Organization routing foundation added for `/btc`, `/bridge`, and `/city2city`.
- Organization identity can frame the existing check-in, history, and leaderboard continuity surface without replacing the current flow.
- Supabase migration added organizations, memberships, and optional organization-scoped check-ins for future organization-level continuity.
- Role and admin foundation added for player, coach, admin, parent, and owner roles.
- Organization admin route supports lightweight invites, member removal, role assignment, attendance continuity viewing, and optional feature toggles without introducing dashboard-heavy UI.
- Operational maturity pass added tokenized organization invite links, a `/join/[token]` player onboarding route, invite acceptance into active memberships, organization attendance percentage, active-member count, participation continuity, and streak leaders.
- Check-in persistence now treats an existing same-day saved check-in as a successful continuity state, reducing duplicate rows and protecting streak and leaderboard consistency.
- Organization foundation stabilized around the canonical model: organizations expose `logo`, members expose `joined_at`, `/[organization]` remains an Axis world layer, and `organization_owner` is now a supported role without fragmenting Axis into white-label apps.
- Organization onboarding now has a fast `/join` entry surface for signed-in users to paste invite codes or invite links, then continue into `/join/[token]`, accept membership, and land inside the organization world for first check-in.
- Organization worlds now show quiet live context from real scoped data: checked-in today, active streak leader, and most active this week, helping the member surface feel like a training culture instead of a solo habit tracker.
- Check-in persistence stabilization removed silent organization fallback inserts, added explicit checking/history-updated client states, and keeps failed persistence visible with human operational errors.
- Real history objects now drive the history surface: current-month days come from saved check-in dates, missed days are explicit, recent records show timestamp and organization context, and summary values come from persisted continuity data only.
- Real leaderboard system now ranks only persisted check-in activity across most active today, weekly hours, active streaks, monthly consistency, and total sessions, with clearer earned placement labels like `#1 TODAY`.
- Mobile-first athletic interaction pass moved the check-in ritual higher in the small-screen flow, enlarged touch targets, reduced mobile scan weight, hid nonessential activity meter detail, and improved safe-area spacing for one-handed gym use.
- Session completion loop added checkout on the saved check-in record, optional one-line reflection, and the completed states `Checking out`, `Checked out`, and `History updated` so Axis can track completed effort cycles.
- Admin visibility now gives coaches a calm daily summary from real organization check-ins: checked in, completed sessions, active today, top streak, and recent participation activity without adding surveillance or analytics-heavy UI.

FUTURE LAYERS

Status: paused

- Media, commentary, feeds, vision, and analytics remain paused until identity, presence, and history stabilize.
- Future layers must inherit from the ritual continuity loop later.

## Current Active Loop

show up -> check in -> history grows -> return tomorrow
