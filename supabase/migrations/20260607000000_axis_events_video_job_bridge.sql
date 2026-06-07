alter table public.axis_events
  add column if not exists label text,
  add column if not exists time_seconds numeric,
  add column if not exists note text,
  add column if not exists source_job_id text,
  add column if not exists video_id text,
  add column if not exists organization_id uuid,
  add column if not exists type text,
  add column if not exists started_at bigint,
  add column if not exists ended_at bigint,
  add column if not exists frame_start integer,
  add column if not exists frame_end integer,
  add column if not exists origin_x double precision,
  add column if not exists origin_y double precision,
  add column if not exists terminus_x double precision,
  add column if not exists terminus_y double precision,
  add column if not exists zone text,
  add column if not exists primary_track_id text,
  add column if not exists participant_track_ids text[] default '{}',
  add column if not exists position_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists tallies jsonb not null default '[]'::jsonb,
  add column if not exists confidence double precision default 1.0,
  add column if not exists detection_count integer default 0,
  add column if not exists track_count integer default 0;

alter table public.axis_events
  alter column session_id drop not null;

create index if not exists axis_events_source_job_time_idx
  on public.axis_events (source_job_id, started_at);

create index if not exists axis_events_video_id_time_idx
  on public.axis_events (video_id, started_at);
