alter table public.axis_video_jobs
  add column if not exists cloudflare_uid text,
  add column if not exists upload_url_created_at timestamptz,
  add column if not exists video_ready_at timestamptz,
  add column if not exists mp4_ready_at timestamptz;

alter table public.axis_video_jobs
  alter column storage_provider set default 'cloudflare';

alter table public.axis_video_jobs
  drop constraint if exists axis_video_jobs_status_check,
  drop constraint if exists axis_video_jobs_storage_provider_check;

alter table public.axis_video_jobs
  add constraint axis_video_jobs_status_check
  check (status in (
    'uploading',
    'uploaded',
    'stream_processing',
    'ready_for_axis_processing',
    'axis_processing',
    'replay_ready',
    'failed'
  )),
  add constraint axis_video_jobs_storage_provider_check
  check (storage_provider in ('cloudflare', 'mux', 'supabase'));

create index if not exists axis_video_jobs_cloudflare_uid_idx on public.axis_video_jobs (cloudflare_uid);
create index if not exists axis_video_jobs_video_ready_at_idx on public.axis_video_jobs (video_ready_at desc);
create index if not exists axis_video_jobs_mp4_ready_at_idx on public.axis_video_jobs (mp4_ready_at desc);
