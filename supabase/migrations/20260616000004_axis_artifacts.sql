create table if not exists axis_artifacts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references axis_threads(id) on delete cascade,
  event_id uuid references axis_thread_events(id) on delete set null,
  type text not null check (type in ('text', 'sketch', 'image', 'stat', 'plan')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists axis_artifacts_thread_id_idx on axis_artifacts (thread_id);
create index if not exists axis_artifacts_type_idx on axis_artifacts (type);

alter table axis_artifacts enable row level security;

create policy "Users can manage their own artifacts"
  on axis_artifacts
  for all
  using (
    thread_id in (
      select id from axis_threads where user_id = auth.uid()
    )
  );
