alter table public.axis_missions
  drop constraint if exists axis_missions_status_check;

alter table public.axis_missions
  add constraint axis_missions_status_check
  check (status in ('READY', 'ACTIVE', 'PAUSED', 'ENDED', 'EVALUATED'));

alter table public.axis_attempts
  drop constraint if exists axis_attempts_status_check;

alter table public.axis_attempts
  add constraint axis_attempts_status_check
  check (status in ('READY', 'ACTIVE', 'PAUSED', 'ENDED', 'EVALUATED'));

alter table public.axis_attempts
  add column if not exists session_id text;

alter table public.axis_context
  add column if not exists session_id text;

create table if not exists public.axis_sessions (
  id text primary key,
  mission_id uuid not null references public.axis_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  constraint text not null,
  target integer not null,
  result integer not null default 0,
  status text not null default 'ACTIVE'
    check (status in ('READY', 'ACTIVE', 'PAUSED', 'ENDED', 'EVALUATED')),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.axis_mission_events (
  id text primary key,
  session_id text not null references public.axis_sessions(id) on delete cascade,
  mission_id uuid not null references public.axis_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null,
  type text not null
    check (type in (
      'COMMAND',
      'COUNT_RECORDED',
      'MISSION_PAUSED',
      'MISSION_RESUMED',
      'RESULT_RECORDED',
      'SESSION_ENDED',
      'SESSION_EVALUATED',
      'SESSION_STARTED'
    )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists axis_sessions_user_started_idx
  on public.axis_sessions (user_id, started_at desc);

create index if not exists axis_sessions_mission_started_idx
  on public.axis_sessions (mission_id, started_at desc);

create index if not exists axis_mission_events_session_timestamp_idx
  on public.axis_mission_events (session_id, timestamp);

create index if not exists axis_mission_events_user_timestamp_idx
  on public.axis_mission_events (user_id, timestamp desc);

create index if not exists axis_attempts_session_idx
  on public.axis_attempts (session_id);

grant select, insert, update on public.axis_sessions to authenticated;
grant select, insert, update on public.axis_mission_events to authenticated;

alter table public.axis_sessions enable row level security;
alter table public.axis_mission_events enable row level security;

create policy "Users select own sessions"
  on public.axis_sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on public.axis_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on public.axis_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users select own events"
  on public.axis_mission_events for select
  using (auth.uid() = user_id);

create policy "Users insert own events"
  on public.axis_mission_events for insert
  with check (auth.uid() = user_id);

create policy "Users update own events"
  on public.axis_mission_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
