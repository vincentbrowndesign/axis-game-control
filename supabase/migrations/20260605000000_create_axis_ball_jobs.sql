create table if not exists public.axis_ball_jobs (
  job_id text primary key,
  status text not null default 'processing',
  storage_provider text not null default 'mux',
  storage_path text not null,
  mux_upload_id text,
  mux_playback_id text,
  video_url text not null,
  ball_track jsonb not null default '[]'::jsonb,
  ball_track_count integer not null default 0,
  frame_count integer not null default 0,
  detection_count integer not null default 0,
  error text,
  trigger_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_ball_jobs_status_check check (status in ('processing', 'ready', 'failed')),
  constraint axis_ball_jobs_storage_provider_check check (storage_provider in ('mux'))
);

create index if not exists axis_ball_jobs_status_idx on public.axis_ball_jobs (status);
create index if not exists axis_ball_jobs_created_at_idx on public.axis_ball_jobs (created_at desc);
create index if not exists axis_ball_jobs_mux_playback_id_idx on public.axis_ball_jobs (mux_playback_id);
