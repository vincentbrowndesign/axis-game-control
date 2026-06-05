alter table public.axis_ball_jobs
  add column if not exists processing_stage text not null default 'uploading';

alter table public.axis_ball_jobs
  drop constraint if exists axis_ball_jobs_processing_stage_check;

alter table public.axis_ball_jobs
  add constraint axis_ball_jobs_processing_stage_check
  check (processing_stage in ('uploading', 'extracting_frames', 'detecting_basketball', 'building_track', 'rendering_replay', 'complete', 'failed'));

create index if not exists axis_ball_jobs_processing_stage_idx on public.axis_ball_jobs (processing_stage);
