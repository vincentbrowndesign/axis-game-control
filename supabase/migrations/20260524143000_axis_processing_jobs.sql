create table if not exists public.axis_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.axis_sessions(id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  progress numeric not null default 0,
  attempts integer not null default 0,
  detail text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_processing_jobs_type_check check (
    type in (
      'upload',
      'tracking',
      'telemetry',
      'replay_generation',
      'clip_generation',
      'stats_generation',
      'broadcast_generation'
    )
  ),
  constraint axis_processing_jobs_status_check check (
    status in ('queued', 'processing', 'complete', 'failed', 'waiting')
  ),
  constraint axis_processing_jobs_session_type_unique unique (session_id, type)
);

create index if not exists axis_processing_jobs_session_idx
  on public.axis_processing_jobs(session_id, queued_at);

create index if not exists axis_processing_jobs_user_status_idx
  on public.axis_processing_jobs(user_id, status, queued_at);

alter table public.axis_processing_jobs enable row level security;

drop policy if exists "Processing jobs are owned by user" on public.axis_processing_jobs;
create policy "Processing jobs are owned by user"
  on public.axis_processing_jobs
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
