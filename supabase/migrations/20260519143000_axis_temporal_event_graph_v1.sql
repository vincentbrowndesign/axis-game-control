create table if not exists public.sessions (
  id uuid primary key,
  operator_id uuid references auth.users(id) on delete set null,
  status text not null default 'READY',
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds numeric,
  playback_url text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  session_time numeric not null default 0,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.snapshots (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_time numeric not null default 0,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_operator_id_idx
  on public.sessions(operator_id);

create index if not exists sessions_status_idx
  on public.sessions(status);

create index if not exists sessions_created_at_idx
  on public.sessions(created_at desc);

create index if not exists events_session_time_idx
  on public.events(session_id, session_time);

create index if not exists events_type_idx
  on public.events(type);

create index if not exists events_payload_idx
  on public.events using gin(payload);

create index if not exists snapshots_session_time_idx
  on public.snapshots(session_id, session_time);

alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.snapshots enable row level security;

drop policy if exists "operators can read own sessions" on public.sessions;
create policy "operators can read own sessions"
  on public.sessions for select
  to authenticated
  using (operator_id = auth.uid());

drop policy if exists "operators can create own sessions" on public.sessions;
create policy "operators can create own sessions"
  on public.sessions for insert
  to authenticated
  with check (operator_id = auth.uid());

drop policy if exists "operators can update own sessions" on public.sessions;
create policy "operators can update own sessions"
  on public.sessions for update
  to authenticated
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

drop policy if exists "operators can read own events" on public.events;
create policy "operators can read own events"
  on public.events for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = events.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can create own events" on public.events;
create policy "operators can create own events"
  on public.events for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id = events.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can read own snapshots" on public.snapshots;
create policy "operators can read own snapshots"
  on public.snapshots for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = snapshots.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can create own snapshots" on public.snapshots;
create policy "operators can create own snapshots"
  on public.snapshots for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id = snapshots.session_id
        and sessions.operator_id = auth.uid()
    )
  );
