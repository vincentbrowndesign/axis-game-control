# Progress Tracker

## Stabilized Verticals

PRODUCT LOCK

Status: active

- Axis is locked as an athletic continuity operating system: identity -> participation -> progression -> history -> leaderboard -> return behavior.
- Future work should refine stability, mobile usability, operational trust, and semantic clarity instead of creating new identity pivots.
- Replay, speculative AI, telemetry experiments, media expansion, feeds, and dashboard patterns remain inactive future boundaries.
- Legacy replay/runtime UI routes are archived out of active App Router runtime so `/` and active navigation stay continuity-first.
- Runtime boundaries are now documented in `/context/runtime-boundaries.md`: archived replay routes must not mount, link, redirect, or return as active navigation.
- Active product lock added: archived replay UX route segments are centralized in `/lib/axis-active-product/routes.ts`, reserved from organization slugs, and blocked at proxy level with 404 responses.
- Entry split added: signed-in users now land on a clear Player vs Organization choice surface so the active product separates emotional participation from operational culture visibility without creating separate apps.
- Player loop refined: the visible player surface now centers on the Check In/Check Out ritual, weekly continuity, streak, history grid, and leaderboard movement while hiding extra org/world/session workflow layers from the daily player experience.
- Extreme minimalism pass reduced active screens toward one dominant action, one emotional state, and one continuity signal: the player surface now centers on the ritual plus one primary history object, and the signed-in entry copy is shorter.

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
- Palette direction now favors sports-electronics contrast: black, white, lime green, and active athletic participation over cold replay-era voids.
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
- Light surface athletic pass moved the member home away from heavy cinematic darkness toward sharper sports-system contrast and calmer active signals.
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
- Organization leaderboard now adds culture momentum from real persisted activity, ranking organizations by most active week, consistency, org streaks, completed sessions, and logged hours without adding social-media mechanics.
- Continuity engine pass centralized Axis day/week/streak math so check-in, check-out, token check-in, session progress, history, profile, admin visibility, reminders, and leaderboards share the same persistence window instead of drifting between server time and product time.

ORGANIZATIONS

Status: foundation

- Organization routing foundation is active for `/bridge` and `/city2city`.
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
- Real activity pass added saved participation signals to the member and organization worlds: active today, organization activity, recent check-ins, streak movement, and weekly leading organization all come from persisted check-in records.
- Calendar/progression refinement made the continuity calendar the primary emotional object with stronger active-day treatment, tactile completed-day tiles, visible streak chains, softer future states, and quieter supporting metadata.
- Organization culture layer added real organization identity cards inside the shared Axis world, showing active communities, participation metrics, completion detail, and culture signals from persisted organization check-ins.
- Lightweight session flow now appears after check-in with persisted segment states for Warmup, Station 1, Station 2, and Scrimmage. Segments move from started to active to completed, and checkout marks the day complete without adding forms or complex workout tooling.
- Home continuity added optional one-tap effort records for home workout, recovery, film study, mobility work, and shooting workout so streak/history can grow beyond physical practice without surveillance or extra forms.
- Identity token infrastructure added the first physical layer: users can create an Axis tag URL for QR/NFC use, and `/t/[token]` performs a real token-based check-in that updates history without turning the wearable into surveillance hardware.
- Daily return reminders now generate quiet in-product continuity prompts from real streak, organization, and leaderboard state so return behavior feels supported rather than spammed.
- Player profile save file added at `/profile`, showing current streak, total sessions, saved time, organization, active history calendar, leaderboard placement, and recent participation from real continuity records.
- Operational trust pass added a calm organization pulse for onboarding, persistence, participation, continuity, and leaderboard health, derived from real members, invites, check-ins, streaks, and completion records.
- Coach and parent trust layer added lightweight continuity visibility for completed sessions, active streaks, weekly check-ins, most consistent member, last completed session, and member-level effort accumulation without surveillance language.
- Organization operating system pass added a lightweight org overview for active members, session participation, continuity, streak systems, and participation health so organizations can run training culture from real participation records.
- Future replay infrastructure pass preserved upload/session/media foundations while removing active replay-native navigation from the saved games archive; replay remains dormant future proof of effort history.
- Legacy replay surfaces were moved to `/archive/legacy-replay-runtime`: replay-native, AxisShell draw/dot/voice/scrub/wipe, game-day upload UI, games archive UI, CV/RF demos, measures prototypes, and replay canvas components. Backend media, upload, Mux, timeline, and CV foundations remain preserved.
- Replay-era runtime references were hardened by removing active `replayHref` values and archived-page revalidation from session/upload processing routes. Archived slugs remain reserved to prevent fallback organization routing.
- Real session hours system now derives effort time from check-in to check-out timestamps, showing completed hours this week/month/total, last-session duration, and real completed-time leaderboard hours without counting open sessions.
- Real organization activity now uses saved organization check-ins to show unique active-today counts, weekly participation, open active sessions, recent check-ins, and active streak leaders across member worlds and coach/admin visibility.
- Session culture layer added lightweight session titles and type selection, organization context, active-member signal, participation continuity, completion status, and persisted `Open Gym` default so sessions feel like living athletic events rather than forms.
- Athletic profile evolution made `/profile` feel more like an earned save file, with a stronger identity surface and records for current streak, total sessions, hours invested, active month, organization, and current rank from real participation history.
- Axis world feel pass added a quiet world-presence rail to member organization surfaces, summarizing active organizations, live sessions, streak leaders, and growing history from persisted participation signals without creating a feed.
- Real-world onboarding now carries invite acceptance into the organization world, shows a restrained first-check-in path, and marks the first completed session with `History started`, `streak active`, and `return tomorrow` without adding startup onboarding flows.
- Organization system refinement tightened the coach/admin surface into culture operations: live participation status, completion, attendance health, continuity trust, support visibility, member roles, invites, and optional trust layers stay operational without becoming enterprise dashboard software.
- Organization invite system added human invite codes and links for Bridge and City 2 City, including `/join?org=bridge&code=BRIDGE2025` and `/join/bridge/BRIDGE2025`, while archiving the old BTC seed from the active organization set.
- Organization join and invite management now shows real organization entry context, active-member signals, checked-in-today counts, and active streaks on valid invite links. Coaches/admins can create invite codes, copy invite links, disable pending invites, view joined members, and assign basic roles from the lightweight organization surface.
- Palette lock pass set the permanent Axis palette to black, white, and lime green only, removing beige/wellness direction from the constitution, design tokens, and active entry/profile/join/admin surfaces.
- Invite flow rebuild made invite links the primary product path: `/join/bridge/ABCD123` and `/join/city2city/EFGH456` now auto-load the organization surface with member/check-in/streak signals before auth or acceptance, while manual invite entry is only a quiet fallback.
- Join language pass grounded organization entry around direct onboarding language: `Join your organization`, `Join Bridge`, and `Join City 2 City` replace abstract invite wording while preserving the minimal progression path.

FUTURE LAYERS

Status: paused

- Media, commentary, feeds, vision, and analytics remain paused until identity, participation, progression, history, and leaderboard are operationally stable.
- Future layers must inherit from the ritual continuity loop later.

## Current Active Loop

show up -> participate -> progression updates -> history grows -> leaderboard updates -> return tomorrow
