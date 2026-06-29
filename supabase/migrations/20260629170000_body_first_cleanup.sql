-- Axis Basketball body-first cleanup.
-- The earlier court-overlay/event-review schema was the wrong MVP path.

drop table if exists public.basketball_clips cascade;
drop table if exists public.basketball_shot_attempts cascade;
drop table if exists public.basketball_reviewed_events cascade;
drop table if exists public.basketball_ai_event_candidates cascade;
drop table if exists public.basketball_recordings cascade;
drop table if exists public.basketball_overlay_configs cascade;
drop table if exists public.basketball_overlay_presets cascade;

create table if not exists public.basketball_body_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  camera_facing text not null default 'environment',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.basketball_pose_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body_session_id uuid not null references public.basketball_body_sessions(id) on delete cascade,
  timestamp_ms bigint not null,
  camera_facing text not null,
  body_detected boolean not null default false,
  landmark_confidence numeric,
  landmarks jsonb not null default '{}'::jsonb,
  body_center jsonb,
  shoulder_line_angle numeric,
  hip_line_angle numeric,
  spine_angle numeric,
  torso_lean text,
  stance_width text,
  balance_estimate text,
  knee_angles jsonb not null default '{}'::jsonb,
  hip_angles jsonb not null default '{}'::jsonb,
  elbow_angles jsonb not null default '{}'::jsonb,
  movement jsonb not null default '{}'::jsonb,
  reads jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.basketball_body_read_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body_session_id uuid not null references public.basketball_body_sessions(id) on delete cascade,
  stance text,
  balance text,
  knee_bend text,
  hip_level text,
  shoulder_level text,
  torso_lean text,
  body_center text,
  movement_quality text,
  confidence numeric,
  sample_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.basketball_body_sessions enable row level security;
alter table public.basketball_pose_samples enable row level security;
alter table public.basketball_body_read_summaries enable row level security;

create policy "basketball_body_sessions_owner_select" on public.basketball_body_sessions
  for select using (auth.uid() = user_id);
create policy "basketball_body_sessions_owner_insert" on public.basketball_body_sessions
  for insert with check (auth.uid() = user_id);
create policy "basketball_body_sessions_owner_update" on public.basketball_body_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "basketball_body_sessions_owner_delete" on public.basketball_body_sessions
  for delete using (auth.uid() = user_id);

create policy "basketball_pose_samples_owner_select" on public.basketball_pose_samples
  for select using (auth.uid() = user_id);
create policy "basketball_pose_samples_owner_insert" on public.basketball_pose_samples
  for insert with check (auth.uid() = user_id);
create policy "basketball_pose_samples_owner_delete" on public.basketball_pose_samples
  for delete using (auth.uid() = user_id);

create policy "basketball_body_read_summaries_owner_select" on public.basketball_body_read_summaries
  for select using (auth.uid() = user_id);
create policy "basketball_body_read_summaries_owner_insert" on public.basketball_body_read_summaries
  for insert with check (auth.uid() = user_id);
create policy "basketball_body_read_summaries_owner_update" on public.basketball_body_read_summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "basketball_body_read_summaries_owner_delete" on public.basketball_body_read_summaries
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.basketball_body_sessions to authenticated;
grant select, insert, delete on public.basketball_pose_samples to authenticated;
grant select, insert, update, delete on public.basketball_body_read_summaries to authenticated;

create index if not exists idx_basketball_body_sessions_user_id
  on public.basketball_body_sessions(user_id);
create index if not exists idx_basketball_pose_samples_session_time
  on public.basketball_pose_samples(body_session_id, timestamp_ms);
create index if not exists idx_basketball_body_read_summaries_session
  on public.basketball_body_read_summaries(body_session_id);
