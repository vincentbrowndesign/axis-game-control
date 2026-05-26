alter table public.axis_training_check_ins
  add column if not exists session_segments jsonb not null default '[
    {"id":"warmup","label":"Warmup","status":"active"},
    {"id":"station-1","label":"Station 1","status":"started"},
    {"id":"station-2","label":"Station 2","status":"started"},
    {"id":"scrimmage","label":"Scrimmage","status":"started"}
  ]'::jsonb;
