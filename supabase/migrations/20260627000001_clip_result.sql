-- ── clip_results ──────────────────────────────────────────────────────────────
-- One row per processed clip. Always created, even when no stat events found.
-- Stores source probe output and analysis summary.

create table if not exists public.clip_results (
  id                    uuid        primary key default gen_random_uuid(),
  clip_id               uuid        not null references public.clip_sources(id) on delete cascade unique,
  owner_id              uuid        not null references auth.users(id) on delete cascade,

  -- Source probe
  is_playable           boolean     not null default false,
  source_type           text,
  -- 'raw_game' | 'screen_recording' | 'gallery_playback' | 'unknown'
  court_visible         boolean,
  hoop_visible          boolean,
  players_visible       boolean,
  scoreboard_visible    boolean,
  action_window_found   boolean,
  source_quality        text,
  -- 'good' | 'fair' | 'poor' | 'unusable'
  probe_notes           text,

  -- Analysis summary
  frames_analyzed       integer     not null default 0,
  scoreboards_read      integer     not null default 0,
  score_changes_found   integer     not null default 0,
  events_detected       integer     not null default 0,
  events_counted        integer     not null default 0,

  -- Outcome
  outcome               text        not null default 'pending',
  -- 'pending' | 'success' | 'no_events' | 'poor_quality' | 'failed'
  outcome_reason        text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_clip_results_clip
  on public.clip_results(clip_id);

alter table public.clip_results enable row level security;

create policy "clip_results_owner_select" on public.clip_results
  for select using (auth.uid() = owner_id);
create policy "clip_results_owner_insert" on public.clip_results
  for insert with check (auth.uid() = owner_id);
create policy "clip_results_owner_update" on public.clip_results
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "clip_results_owner_delete" on public.clip_results
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.clip_results to authenticated;
