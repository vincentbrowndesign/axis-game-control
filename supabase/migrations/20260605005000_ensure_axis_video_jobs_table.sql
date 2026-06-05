create table if not exists public.axis_video_jobs (
  id uuid primary key default gen_random_uuid(),
  cloudflare_uid text,
  status text not null default 'uploading',
  filename text,
  file_size bigint,
  upload_url text,
  upload_url_created_at timestamptz default now(),
  video_ready_at timestamptz,
  mp4_ready_at timestamptz,
  ball_track_count integer default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.axis_video_jobs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists cloudflare_uid text,
  add column if not exists status text not null default 'uploading',
  add column if not exists filename text,
  add column if not exists file_size bigint,
  add column if not exists upload_url text,
  add column if not exists upload_url_created_at timestamptz default now(),
  add column if not exists video_ready_at timestamptz,
  add column if not exists mp4_ready_at timestamptz,
  add column if not exists ball_track_count integer default 0,
  add column if not exists error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists job_id text,
  add column if not exists asset_id text,
  add column if not exists storage_path text,
  add column if not exists storage_provider text default 'cloudflare',
  add column if not exists video_url text,
  add column if not exists ball_track jsonb not null default '[]'::jsonb,
  add column if not exists frame_count integer default 0,
  add column if not exists detection_count integer default 0,
  add column if not exists processing_stage text default 'uploading',
  add column if not exists progress integer default 0,
  add column if not exists trigger_run_id text,
  add column if not exists mux_upload_id text,
  add column if not exists mux_playback_id text;

alter table public.axis_video_jobs
  drop constraint if exists axis_video_jobs_status_check,
  drop constraint if exists axis_video_jobs_storage_provider_check,
  drop constraint if exists axis_video_jobs_progress_check;

alter table public.axis_video_jobs
  add constraint axis_video_jobs_status_check
  check (status in (
    'uploading',
    'uploaded',
    'stream_processing',
    'ready_for_axis_processing',
    'axis_processing',
    'replay_ready',
    'failed',
    'queued',
    'processing',
    'ready'
  )),
  add constraint axis_video_jobs_storage_provider_check
  check (storage_provider is null or storage_provider in ('cloudflare', 'mux', 'supabase')),
  add constraint axis_video_jobs_progress_check
  check (progress is null or (progress >= 0 and progress <= 100));

create index if not exists axis_video_jobs_cloudflare_uid_idx on public.axis_video_jobs (cloudflare_uid);
create index if not exists axis_video_jobs_status_idx on public.axis_video_jobs (status);
create index if not exists axis_video_jobs_created_at_idx on public.axis_video_jobs (created_at desc);
create index if not exists axis_video_jobs_job_id_idx on public.axis_video_jobs (job_id);
