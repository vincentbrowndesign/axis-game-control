alter table public.axis_video_jobs
  add column if not exists replay_cloudflare_uid text,
  add column if not exists replay_video_url text,
  add column if not exists replay_mp4_url text,
  add column if not exists replay_export_path text,
  add column if not exists replay_export_size_bytes bigint,
  add column if not exists replay_export_width integer,
  add column if not exists replay_export_height integer,
  add column if not exists player_track jsonb not null default '[]'::jsonb,
  add column if not exists player_track_count integer default 0;

create index if not exists axis_video_jobs_replay_cloudflare_uid_idx
  on public.axis_video_jobs (replay_cloudflare_uid);
