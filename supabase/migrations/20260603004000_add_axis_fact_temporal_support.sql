alter table public.axis_artifact_facts
  add column if not exists temporal_support text;
