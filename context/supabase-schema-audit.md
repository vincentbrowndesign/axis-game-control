# Supabase Schema Audit

Date: 2026-05-25

Scope: live Supabase project `xffhrvxqkwlbzphgnwvd`.

No destructive operations were performed.

## Current Product Filter

Axis is currently organized around:

show up -> check in -> progression -> history -> leaderboard -> return tomorrow

Tables, buckets, and policies should be judged by whether they support that loop now, preserve identity/history continuity, or provide a deliberate dormant foundation for future media layers.

## Active Core

These tables support the current product direction most directly.

| Table | Rows | Role | Status |
| --- | ---: | --- | --- |
| `axis_profiles` | 5 | User profile continuity mapped to Supabase auth identities. | Keep |
| `axis_training_check_ins` | 0 | Current check-in, streak, history, and leaderboard source. | Keep and stabilize |

Current check-in persistence uses Clerk on the app side and service-role Supabase inserts through API routes. `axis_training_check_ins` also has `user_id` for Supabase auth compatibility and `clerk_user_id` for Clerk continuity.

## Preserved Future Foundations

These tables are not the active daily loop, but they preserve working upload, media, replay, or processing foundations that should not be blindly removed.

| Table | Rows | Role | Status |
| --- | ---: | --- | --- |
| `axis_sessions` | 89 | Uploaded media/session records. | Keep, but fix policies |
| `axis_uploads` | 40 | Upload records linked to `axis_sessions`. | Keep |
| `axis_processing_jobs` | 0 | Background job foundation. | Keep |
| `axis_events` | 21 | Session event/memory foundation. | Dormant keep |
| `axis_session_analysis` | 3 | Session summary foundation. | Dormant keep |
| `axis_behavioral_memory` | 0 | Future replay/intelligence memory. | Dormant keep |

These are future-ready media foundations. They should remain available while replay/media is paused.

## Legacy / Archive Candidates

These tables reflect older temporal, training-memory, live-session, or basketball game-state systems. Some still have old API references, so they should be quarantined by route review before removal.

| Table family | Tables | Rows | Recommendation |
| --- | --- | ---: | --- |
| Temporal live session stack | `sessions`, `events`, `snapshots`, `training_memories` | `sessions`: 150, `events`: 106, others mostly 0 | Archive after old `/api/live/*`, `training-memory`, and chronology routes are retired or migrated. |
| Basketball game-state stack | `teams`, `players`, `game_sessions`, `game_players`, `game_events`, `lineup_segments`, `sub_events`, `review_marks` | all estimated 0 | Strong archive candidate after confirming no active route depends on it. |

The legacy stacks are the clearest replay-era drift. They do not serve the current check-in -> history -> leaderboard loop.

## Missing Canonical Tables

The desired current model references these concepts, but the live schema does not yet have clean first-class tables for all of them:

- `organizations`
- `memberships`
- `sessions` as a V1 attendance/progression concept, distinct from old live media `sessions`
- `streaks`
- `leaderboard_stats`
- optional future `session_steps`

Do not add these during cleanup unless a focused unit requires them. For now, leaderboard and history are derived from `axis_training_check_ins`.

## Storage Audit

| Bucket | Public | Objects | Size | Recommendation |
| --- | --- | ---: | ---: | --- |
| `axis-replays` | false | 171 | 525 MB | Keep. This is the main future media foundation. |
| `axis-memory` | false | 0 | 0 bytes | Keep or archive later after confirming intent. |
| `session-archives` | false | 0 | 0 bytes | Keep as future archive foundation. |
| `game-film` | true | 0 | 0 bytes | Archive candidate; public and empty. |
| `session-snapshots` | true | 0 | 0 bytes | Archive candidate tied to old `sessions`/`snapshots`. |
| `training-frames` | true | 0 | 0 bytes | Archive candidate tied to old `training_memories`. |

Only `axis-replays` contains real media. Top-level folders under `axis-replays` currently map to two user/session-like IDs, totaling 525 MB.

## Policy Risks

Highest priority security cleanup:

- `axis_sessions` has a public `allow all` policy for `ALL` with `USING true` and `WITH CHECK true`.
- `game_sessions`, `game_events`, and `game_players` have public allow-all insert/select/update style policies.
- `teams`, `players`, `lineup_segments`, `sub_events`, and `review_marks` have RLS enabled but no policies.
- `axis_training_check_ins` has an `auth.uid() = user_id` policy, while the active app currently writes through Clerk-backed API routes using the service role. This is acceptable for API-mediated access, but direct client access would need a Clerk-compatible authorization design.

The public allow-all policies should be fixed before any broader production exposure. This is safer than deleting tables first.

Supabase security advisor confirmed:

- permissive always-true policy warnings on `axis_sessions`, `game_sessions`, `game_events`, and `game_players`
- RLS-enabled-without-policy notices on several empty game-state tables
- leaked password protection disabled in Supabase Auth

## Index / Performance Notes

Duplicate indexes:

- `events_session_time_idx` and `events_session_time_lookup_idx`
- `snapshots_session_time_idx` and `snapshots_session_time_lookup_idx`

Unindexed foreign keys were reported on several dormant tables and some preserved tables:

- `axis_behavioral_memory.session_id`
- `axis_events.user_id`
- `axis_session_analysis.user_id`
- `axis_uploads.session_id`
- multiple game-state foreign keys

Unused index notices exist across several old and future tables. Do not drop them based only on advisor output until the route surface is finalized.

## Triggers / Functions

No custom `public` functions were found.

No custom `public` table triggers were found. Trigger output was limited to Supabase-managed `storage` and `realtime` triggers.

## Code Reference Summary

Current active references:

- `lib/axis-daily/attendance.ts` uses `axis_training_check_ins`
- `lib/axis-daily/leaderboard.ts` uses `axis_training_check_ins`
- upload/session APIs use `axis_sessions`, `axis_uploads`, `axis_processing_jobs`, and `axis-replays`

Legacy references still exist:

- `lib/axisChronologyStore.ts` uses `events`, `snapshots`, and `session-snapshots`
- `/api/live/*` routes use `sessions`, `events`, `snapshots`, and `training_memories`
- `/api/training-memory/*` and `/api/roboflow/upload-training-frame` use `training_memories` and `training-frames`

Those legacy routes should be archived or disabled before dropping their tables/buckets.

## Recommended Cleanup Sequence

1. Backup first.
   - Export schema.
   - Export table data for all public tables.
   - Export storage object manifest for all buckets.
   - Preserve local migration history.

2. Lock down risky policies.
   - Remove the public allow-all policy from `axis_sessions`.
   - Remove public insert/update policies from empty game-state tables, or move those tables behind service-role-only APIs.
   - Keep RLS enabled.

3. Quarantine legacy route surfaces.
   - Confirm whether `/api/live/*`, `/api/training-memory/*`, chronology state, and old game-state routes are still reachable in production.
   - If not active, archive the route files before moving/dropping backing schema.

4. Archive empty experimental objects.
   - Move empty game-state tables to an archive schema or export/drop only after backup and explicit approval.
   - Archive empty public storage buckets after confirming no code writes to them.

5. Preserve media foundations.
   - Keep `axis-replays`, `axis_sessions`, `axis_uploads`, and `axis_processing_jobs`.
   - Treat replay/media as dormant infrastructure until the identity -> presence -> history loop stabilizes.

6. Normalize the active model later.
   - Add organizations/memberships only as a focused unit.
   - Add materialized `leaderboard_stats` only if derived queries become slow.
   - Keep `axis_training_check_ins` as the current source of truth until a migration is deliberately planned.

## Do Not Run Without Approval

Any future destructive cleanup must be preceded by backup/export and explicit approval. Candidate destructive operations include:

- dropping public allow-all policies
- moving tables into an archive schema
- deleting empty storage buckets
- dropping duplicate indexes
- removing legacy route-backed tables

