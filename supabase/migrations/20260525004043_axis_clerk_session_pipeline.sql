alter table public.axis_sessions
  add column if not exists clerk_user_id text;

alter table public.axis_uploads
  add column if not exists clerk_user_id text;

alter table public.axis_processing_jobs
  add column if not exists clerk_user_id text,
  add column if not exists current_step text not null default 'queued';

alter table public.axis_uploads
  alter column user_id drop not null;

alter table public.axis_processing_jobs
  alter column user_id drop not null;

create index if not exists axis_sessions_clerk_user_id_created_at_idx
  on public.axis_sessions(clerk_user_id, created_at desc);

create index if not exists axis_uploads_clerk_user_id_idx
  on public.axis_uploads(clerk_user_id);

create index if not exists axis_processing_jobs_clerk_status_idx
  on public.axis_processing_jobs(clerk_user_id, status, queued_at);
