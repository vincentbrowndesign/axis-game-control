alter table public.axis_video_jobs
  add column if not exists focus_player_track_id text;

create index if not exists axis_video_jobs_focus_player_track_id_idx
  on public.axis_video_jobs (focus_player_track_id);
