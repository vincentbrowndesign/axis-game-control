create extension if not exists pgcrypto;

-- ── clip_sources ──────────────────────────────────────────────────────────────
-- One row per video file. Both record and upload paths land here.

create table if not exists public.clip_sources (
  id                  uuid        primary key default gen_random_uuid(),
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  origin              text        not null check (origin in ('recorded', 'uploaded')),
  status              text        not null default 'pending'
                                  check (status in ('pending', 'uploading', 'uploaded', 'processing', 'ready', 'failed')),
  cloudflare_uid      text,
  upload_url          text,
  video_url           text,
  filename            text,
  file_size           bigint,
  duration_seconds    numeric,
  processing_stage    text,
  processing_progress integer     default 0,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_clip_sources_owner
  on public.clip_sources(owner_id, created_at desc);

alter table public.clip_sources enable row level security;

create policy "clip_sources_owner_select" on public.clip_sources
  for select using (auth.uid() = owner_id);
create policy "clip_sources_owner_insert" on public.clip_sources
  for insert with check (auth.uid() = owner_id);
create policy "clip_sources_owner_update" on public.clip_sources
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_sources_owner_delete" on public.clip_sources
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_sources to authenticated;


-- ── clip_setups ───────────────────────────────────────────────────────────────
-- Setup context that seeds the processing pipeline.

create table if not exists public.clip_setups (
  id                  uuid        primary key default gen_random_uuid(),
  clip_id             uuid        not null references public.clip_sources(id) on delete cascade unique,
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  subject_type        text        not null check (subject_type in ('player', 'team')),
  subject_name        text,
  session_type        text        not null check (session_type in ('game', 'practice', 'training')),
  jersey_color        text,
  scoreboard_visible  text        check (scoreboard_visible in ('yes', 'no', 'not_sure')),
  created_at          timestamptz not null default now()
);

alter table public.clip_setups enable row level security;

create policy "clip_setups_owner_select" on public.clip_setups
  for select using (auth.uid() = owner_id);
create policy "clip_setups_owner_insert" on public.clip_setups
  for insert with check (auth.uid() = owner_id);
create policy "clip_setups_owner_update" on public.clip_setups
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_setups_owner_delete" on public.clip_setups
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_setups to authenticated;


-- ── clip_events ───────────────────────────────────────────────────────────────
-- Basketball events extracted from the clip (the Activity feed).

create table if not exists public.clip_events (
  id                  uuid        primary key default gen_random_uuid(),
  clip_id             uuid        not null references public.clip_sources(id) on delete cascade,
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  event_type          text        not null,
  -- shot_attempt | make | miss | rebound | assist | turnover | foul | block | steal | free_throw
  status              text        not null default 'suggested'
                                  check (status in ('counted', 'suggested', 'check', 'skipped')),
  timestamp_seconds   numeric,
  player_label        text,
  points              integer     not null default 0,
  shot_zone           text,
  -- paint | mid_range | three_point | free_throw
  proof               text,
  -- user-facing: "shot detected", "scoreboard changed", "possession changed", "player unclear", "clip blurry"
  metadata            jsonb       not null default '{}'::jsonb,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_clip_events_clip
  on public.clip_events(clip_id, sort_order asc);

alter table public.clip_events enable row level security;

create policy "clip_events_owner_select" on public.clip_events
  for select using (auth.uid() = owner_id);
create policy "clip_events_owner_insert" on public.clip_events
  for insert with check (auth.uid() = owner_id);
create policy "clip_events_owner_update" on public.clip_events
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_events_owner_delete" on public.clip_events
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_events to authenticated;


-- ── clip_plays ────────────────────────────────────────────────────────────────
-- Ambiguous events that need user review.

create table if not exists public.clip_plays (
  id                  uuid        primary key default gen_random_uuid(),
  clip_id             uuid        not null references public.clip_sources(id) on delete cascade,
  event_id            uuid        references public.clip_events(id) on delete set null,
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  question            text        not null,
  context             text,
  timestamp_seconds   numeric,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'resolved')),
  resolution          text,
  -- counted | skipped | make | miss | foul | rebound | assist | turnover
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_clip_plays_clip
  on public.clip_plays(clip_id, created_at asc);

alter table public.clip_plays enable row level security;

create policy "clip_plays_owner_select" on public.clip_plays
  for select using (auth.uid() = owner_id);
create policy "clip_plays_owner_insert" on public.clip_plays
  for insert with check (auth.uid() = owner_id);
create policy "clip_plays_owner_update" on public.clip_plays
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_plays_owner_delete" on public.clip_plays
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_plays to authenticated;


-- ── clip_press_packs ──────────────────────────────────────────────────────────
-- Generated narrative from Activity + Stats.

create table if not exists public.clip_press_packs (
  id                  uuid        primary key default gen_random_uuid(),
  clip_id             uuid        not null references public.clip_sources(id) on delete cascade unique,
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  headline            text,
  summary             text,
  key_moments         jsonb       not null default '[]'::jsonb,
  -- [{timestampSeconds, description}]
  stat_lines          jsonb       not null default '{}'::jsonb,
  -- {pts, fgm, fga, fg_pct, tpm, tpa, ftm, fta, reb, ast, stl, blk, to, pf}
  generated_at        timestamptz not null default now()
);

alter table public.clip_press_packs enable row level security;

create policy "clip_press_packs_owner_select" on public.clip_press_packs
  for select using (auth.uid() = owner_id);
create policy "clip_press_packs_owner_insert" on public.clip_press_packs
  for insert with check (auth.uid() = owner_id);
create policy "clip_press_packs_owner_update" on public.clip_press_packs
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_press_packs_owner_delete" on public.clip_press_packs
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_press_packs to authenticated;
