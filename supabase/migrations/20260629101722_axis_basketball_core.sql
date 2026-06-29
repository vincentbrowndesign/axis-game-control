create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.basketball_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade text,
  team text,
  dominant_hand text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  session_type text not null,
  location text,
  session_date timestamptz not null default now(),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_overlay_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  overlay_type text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_overlay_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  preset_id uuid references public.basketball_overlay_presets(id) on delete set null,
  overlay_type text not null,
  opacity numeric not null default 0.65,
  transform jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  overlay_config_id uuid references public.basketball_overlay_configs(id) on delete set null,
  storage_path text,
  local_blob_url text,
  duration_seconds numeric,
  fps numeric,
  width integer,
  height integer,
  status text not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_ai_event_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  recording_id uuid references public.basketball_recordings(id) on delete set null,
  overlay_config_id uuid references public.basketball_overlay_configs(id) on delete set null,
  event_type text not null,
  start_time_seconds numeric,
  end_time_seconds numeric,
  confidence numeric,
  reason text,
  overlay_context jsonb not null default '{}'::jsonb,
  detections jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_reviewed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.basketball_ai_event_candidates(id) on delete set null,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  recording_id uuid references public.basketball_recordings(id) on delete set null,
  event_type text not null,
  start_time_seconds numeric,
  end_time_seconds numeric,
  confidence numeric,
  review_status text not null default 'approved',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.basketball_shot_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  recording_id uuid references public.basketball_recordings(id) on delete set null,
  candidate_id uuid references public.basketball_ai_event_candidates(id) on delete set null,
  player_id uuid references public.basketball_players(id) on delete set null,
  shot_time_seconds numeric,
  shot_zone text,
  result text,
  confidence numeric,
  overlay_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.basketball_shot_attempts is
  'AI-derived shot attempts only at first. No manual shot form in MVP.';

create table if not exists public.basketball_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  recording_id uuid references public.basketball_recordings(id) on delete set null,
  event_id uuid references public.basketball_reviewed_events(id) on delete set null,
  title text not null,
  start_time_seconds numeric,
  end_time_seconds numeric,
  storage_path text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.basketball_sessions(id) on delete cascade,
  player_id uuid references public.basketball_players(id) on delete set null,
  note text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

comment on table public.basketball_coach_notes is
  'Written notes only, not live tagging.';

create trigger set_basketball_players_updated_at
  before update on public.basketball_players
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_sessions_updated_at
  before update on public.basketball_sessions
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_overlay_presets_updated_at
  before update on public.basketball_overlay_presets
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_overlay_configs_updated_at
  before update on public.basketball_overlay_configs
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_recordings_updated_at
  before update on public.basketball_recordings
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_ai_event_candidates_updated_at
  before update on public.basketball_ai_event_candidates
  for each row execute function public.set_current_timestamp_updated_at();

create trigger set_basketball_clips_updated_at
  before update on public.basketball_clips
  for each row execute function public.set_current_timestamp_updated_at();

alter table public.basketball_players enable row level security;
alter table public.basketball_sessions enable row level security;
alter table public.basketball_overlay_presets enable row level security;
alter table public.basketball_overlay_configs enable row level security;
alter table public.basketball_recordings enable row level security;
alter table public.basketball_ai_event_candidates enable row level security;
alter table public.basketball_reviewed_events enable row level security;
alter table public.basketball_shot_attempts enable row level security;
alter table public.basketball_clips enable row level security;
alter table public.basketball_coach_notes enable row level security;

create policy "basketball_players_owner_select" on public.basketball_players
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_players_owner_insert" on public.basketball_players
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_players_owner_update" on public.basketball_players
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_players_owner_delete" on public.basketball_players
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_sessions_owner_select" on public.basketball_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_sessions_owner_insert" on public.basketball_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_sessions_owner_update" on public.basketball_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_sessions_owner_delete" on public.basketball_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_overlay_presets_select" on public.basketball_overlay_presets
  for select to authenticated
  using (is_system = true or (select auth.uid()) = user_id);
create policy "basketball_overlay_presets_owner_insert" on public.basketball_overlay_presets
  for insert to authenticated
  with check ((select auth.uid()) = user_id and is_system = false);
create policy "basketball_overlay_presets_owner_update" on public.basketball_overlay_presets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and is_system = false);
create policy "basketball_overlay_presets_owner_delete" on public.basketball_overlay_presets
  for delete to authenticated
  using ((select auth.uid()) = user_id and is_system = false);

create policy "basketball_overlay_configs_owner_select" on public.basketball_overlay_configs
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_overlay_configs_owner_insert" on public.basketball_overlay_configs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_overlay_configs_owner_update" on public.basketball_overlay_configs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_overlay_configs_owner_delete" on public.basketball_overlay_configs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_recordings_owner_select" on public.basketball_recordings
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_recordings_owner_insert" on public.basketball_recordings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_recordings_owner_update" on public.basketball_recordings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_recordings_owner_delete" on public.basketball_recordings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_ai_event_candidates_owner_select" on public.basketball_ai_event_candidates
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_ai_event_candidates_owner_insert" on public.basketball_ai_event_candidates
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_ai_event_candidates_owner_update" on public.basketball_ai_event_candidates
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_ai_event_candidates_owner_delete" on public.basketball_ai_event_candidates
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_reviewed_events_owner_select" on public.basketball_reviewed_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_reviewed_events_owner_insert" on public.basketball_reviewed_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_reviewed_events_owner_update" on public.basketball_reviewed_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_reviewed_events_owner_delete" on public.basketball_reviewed_events
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_shot_attempts_owner_select" on public.basketball_shot_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_shot_attempts_owner_insert" on public.basketball_shot_attempts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_shot_attempts_owner_update" on public.basketball_shot_attempts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_shot_attempts_owner_delete" on public.basketball_shot_attempts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_clips_owner_select" on public.basketball_clips
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_clips_owner_insert" on public.basketball_clips
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_clips_owner_update" on public.basketball_clips
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_clips_owner_delete" on public.basketball_clips
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "basketball_coach_notes_owner_select" on public.basketball_coach_notes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "basketball_coach_notes_owner_insert" on public.basketball_coach_notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "basketball_coach_notes_owner_update" on public.basketball_coach_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "basketball_coach_notes_owner_delete" on public.basketball_coach_notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.basketball_players to authenticated;
grant select, insert, update, delete on public.basketball_sessions to authenticated;
grant select, insert, update, delete on public.basketball_overlay_presets to authenticated;
grant select, insert, update, delete on public.basketball_overlay_configs to authenticated;
grant select, insert, update, delete on public.basketball_recordings to authenticated;
grant select, insert, update, delete on public.basketball_ai_event_candidates to authenticated;
grant select, insert, update, delete on public.basketball_reviewed_events to authenticated;
grant select, insert, update, delete on public.basketball_shot_attempts to authenticated;
grant select, insert, update, delete on public.basketball_clips to authenticated;
grant select, insert, update, delete on public.basketball_coach_notes to authenticated;

create index if not exists idx_basketball_players_user_id
  on public.basketball_players(user_id);
create index if not exists idx_basketball_players_created_at
  on public.basketball_players(created_at desc);

create index if not exists idx_basketball_sessions_user_id
  on public.basketball_sessions(user_id);
create index if not exists idx_basketball_sessions_created_at
  on public.basketball_sessions(created_at desc);

create index if not exists idx_basketball_overlay_presets_user_id
  on public.basketball_overlay_presets(user_id);
create index if not exists idx_basketball_overlay_presets_overlay_type
  on public.basketball_overlay_presets(overlay_type);
create index if not exists idx_basketball_overlay_presets_created_at
  on public.basketball_overlay_presets(created_at desc);

create index if not exists idx_basketball_overlay_configs_user_id
  on public.basketball_overlay_configs(user_id);
create index if not exists idx_basketball_overlay_configs_session_id
  on public.basketball_overlay_configs(session_id);
create index if not exists idx_basketball_overlay_configs_overlay_type
  on public.basketball_overlay_configs(overlay_type);
create index if not exists idx_basketball_overlay_configs_created_at
  on public.basketball_overlay_configs(created_at desc);

create index if not exists idx_basketball_recordings_user_id
  on public.basketball_recordings(user_id);
create index if not exists idx_basketball_recordings_session_id
  on public.basketball_recordings(session_id);
create index if not exists idx_basketball_recordings_created_at
  on public.basketball_recordings(created_at desc);

create index if not exists idx_basketball_ai_event_candidates_user_id
  on public.basketball_ai_event_candidates(user_id);
create index if not exists idx_basketball_ai_event_candidates_session_id
  on public.basketball_ai_event_candidates(session_id);
create index if not exists idx_basketball_ai_event_candidates_recording_id
  on public.basketball_ai_event_candidates(recording_id);
create index if not exists idx_basketball_ai_event_candidates_event_type
  on public.basketball_ai_event_candidates(event_type);
create index if not exists idx_basketball_ai_event_candidates_review_status
  on public.basketball_ai_event_candidates(review_status);
create index if not exists idx_basketball_ai_event_candidates_created_at
  on public.basketball_ai_event_candidates(created_at desc);

create index if not exists idx_basketball_reviewed_events_user_id
  on public.basketball_reviewed_events(user_id);
create index if not exists idx_basketball_reviewed_events_session_id
  on public.basketball_reviewed_events(session_id);
create index if not exists idx_basketball_reviewed_events_recording_id
  on public.basketball_reviewed_events(recording_id);
create index if not exists idx_basketball_reviewed_events_event_type
  on public.basketball_reviewed_events(event_type);
create index if not exists idx_basketball_reviewed_events_review_status
  on public.basketball_reviewed_events(review_status);
create index if not exists idx_basketball_reviewed_events_created_at
  on public.basketball_reviewed_events(created_at desc);

create index if not exists idx_basketball_shot_attempts_user_id
  on public.basketball_shot_attempts(user_id);
create index if not exists idx_basketball_shot_attempts_session_id
  on public.basketball_shot_attempts(session_id);
create index if not exists idx_basketball_shot_attempts_recording_id
  on public.basketball_shot_attempts(recording_id);
create index if not exists idx_basketball_shot_attempts_created_at
  on public.basketball_shot_attempts(created_at desc);

create index if not exists idx_basketball_clips_user_id
  on public.basketball_clips(user_id);
create index if not exists idx_basketball_clips_session_id
  on public.basketball_clips(session_id);
create index if not exists idx_basketball_clips_recording_id
  on public.basketball_clips(recording_id);
create index if not exists idx_basketball_clips_created_at
  on public.basketball_clips(created_at desc);

create index if not exists idx_basketball_coach_notes_user_id
  on public.basketball_coach_notes(user_id);
create index if not exists idx_basketball_coach_notes_session_id
  on public.basketball_coach_notes(session_id);
create index if not exists idx_basketball_coach_notes_created_at
  on public.basketball_coach_notes(created_at desc);
