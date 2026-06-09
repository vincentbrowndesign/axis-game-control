alter table public.axis_video_jobs
  add column if not exists replay_quality_report jsonb not null default '{
    "ballTrackInterpolatedFrames": 0,
    "ballTrackLostCount": 0,
    "focusInterpolatedFrames": 0,
    "focusTrackLostCount": 0,
    "focusTrackSwitchCount": 0,
    "focusVisibleFrames": 0,
    "replayDuration": 0
  }'::jsonb;
