create table if not exists public.axis_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  constraint text not null,
  target integer not null,
  status text not null default 'READY'
    check (status in ('READY', 'ACTIVE', 'COMPLETE', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, objective, constraint)
);

create table if not exists public.axis_attempts (
  id text primary key,
  mission_id uuid not null references public.axis_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  constraint text not null,
  target integer not null,
  result integer not null,
  status text not null
    check (status in ('READY', 'ACTIVE', 'COMPLETE', 'FAILED')),
  moment text
    check (moment is null or moment in ('RECORD', 'STREAK', 'ALMOST', 'COMPLETE', 'FAILED')),
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.axis_records (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.axis_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  constraint text not null,
  personal_best integer not null default 0,
  streak integer not null default 0,
  last_attempt_id text,
  updated_at timestamptz not null default now(),
  unique (mission_id)
);

create table if not exists public.axis_context (
  id uuid primary key default gen_random_uuid(),
  attempt_id text not null references public.axis_attempts(id) on delete cascade,
  mission_id uuid not null references public.axis_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null,
  constraint text not null,
  result integer not null,
  timestamp timestamptz not null,
  audio_context jsonb,
  camera_context jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (attempt_id)
);

create index if not exists axis_missions_user_updated_idx
  on public.axis_missions (user_id, updated_at desc);

create index if not exists axis_attempts_user_timestamp_idx
  on public.axis_attempts (user_id, timestamp desc);

create index if not exists axis_attempts_mission_timestamp_idx
  on public.axis_attempts (mission_id, timestamp desc);

create index if not exists axis_records_user_updated_idx
  on public.axis_records (user_id, updated_at desc);

create index if not exists axis_context_user_timestamp_idx
  on public.axis_context (user_id, timestamp desc);

grant select, insert, update on public.axis_missions to authenticated;
grant select, insert, update on public.axis_attempts to authenticated;
grant select, insert, update on public.axis_records to authenticated;
grant select, insert, update on public.axis_context to authenticated;

alter table public.axis_missions enable row level security;
alter table public.axis_attempts enable row level security;
alter table public.axis_records enable row level security;
alter table public.axis_context enable row level security;

create policy "Users select own missions"
  on public.axis_missions for select
  using (auth.uid() = user_id);

create policy "Users insert own missions"
  on public.axis_missions for insert
  with check (auth.uid() = user_id);

create policy "Users update own missions"
  on public.axis_missions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users select own attempts"
  on public.axis_attempts for select
  using (auth.uid() = user_id);

create policy "Users insert own attempts"
  on public.axis_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users update own attempts"
  on public.axis_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users select own records"
  on public.axis_records for select
  using (auth.uid() = user_id);

create policy "Users insert own records"
  on public.axis_records for insert
  with check (auth.uid() = user_id);

create policy "Users update own records"
  on public.axis_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users select own context"
  on public.axis_context for select
  using (auth.uid() = user_id);

create policy "Users insert own context"
  on public.axis_context for insert
  with check (auth.uid() = user_id);

create policy "Users update own context"
  on public.axis_context for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
