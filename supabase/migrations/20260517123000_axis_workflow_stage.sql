alter table public.axis_sessions
  add column if not exists workflow_stage text,
  add column if not exists ai_suggested_tags text[] not null default '{}'::text[],
  add column if not exists ai_cluster_id text;

create index if not exists axis_sessions_workflow_stage_idx
  on public.axis_sessions(workflow_stage);

create index if not exists axis_sessions_ai_suggested_tags_idx
  on public.axis_sessions using gin(ai_suggested_tags);

create index if not exists axis_sessions_ai_cluster_id_idx
  on public.axis_sessions(ai_cluster_id);
