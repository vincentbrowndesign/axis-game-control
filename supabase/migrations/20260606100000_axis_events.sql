-- ─── axis_events ─────────────────────────────────────────────────────────────
-- Semantic events derived from track behavior.
-- position_snapshot encodes all object positions at event start so replay
-- can be fully reconstructed without the original video.

create table if not exists axis_events (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null,
  user_id               uuid references auth.users(id) on delete set null,
  organization_id       uuid,
  -- Classification
  type                  text not null
                          check (type in (
                            'drive','kick','cut','relocate','closeout','rotation',
                            'transition','post_entry','hand_off','screen',
                            'shot_attempt','shot_made','shot_missed',
                            'pass','rebound','possession_change','dribble','stationary'
                          )),
  -- Temporal (milliseconds)
  started_at            bigint not null,
  ended_at              bigint not null,
  frame_start           int not null,
  frame_end             int not null,
  -- Spatial (normalized court coords 0–1)
  origin_x              float not null,
  origin_y              float not null,
  terminus_x            float,
  terminus_y            float,
  zone                  text not null,
  -- Track participants
  primary_track_id      text not null,
  participant_track_ids text[]    default '{}',
  -- Full position snapshot (enables video-free replay)
  -- Array of {track_id, entity_type, x, y, frame}
  position_snapshot     jsonb not null default '[]',
  -- Tallies: [{key, value, unit?}]
  tallies               jsonb not null default '[]',
  confidence            float not null default 1.0,
  metadata              jsonb,
  created_at            timestamptz default now()
);

-- Required for PostgREST / JS client access (Supabase explicit grant policy)
grant select, insert, update on axis_events to authenticated;
grant select on axis_events to anon;

-- Row-level security
alter table axis_events enable row level security;

create policy "Users see own events"
  on axis_events for select
  using (auth.uid() = user_id);

create policy "Users insert own events"
  on axis_events for insert
  with check (auth.uid() = user_id);

create policy "Users update own events"
  on axis_events for update
  using (auth.uid() = user_id);

-- Indices for replay reconstruction and session queries
create index if not exists axis_events_session_time
  on axis_events (session_id, started_at);

create index if not exists axis_events_type
  on axis_events (type);

create index if not exists axis_events_user
  on axis_events (user_id, started_at desc);

create index if not exists axis_events_primary_track
  on axis_events (primary_track_id);

comment on table axis_events is
  'Semantic movement events derived from track behavior. '
  'position_snapshot enables video-free replay reconstruction.';
