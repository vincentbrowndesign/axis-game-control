alter table public.axis_video_jobs
  add column if not exists player_track jsonb not null default '[]'::jsonb,
  add column if not exists player_track_count integer not null default 0;

create index if not exists axis_video_jobs_player_track_count_idx
  on public.axis_video_jobs (player_track_count);
