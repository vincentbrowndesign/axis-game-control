create table if not exists public.axis_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  player_name text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.axis_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists file_path text,
  add column if not exists source text default 'upload',
  add column if not exists mission text default 'None',
  add column if not exists player_name text default 'Unassigned',
  add column if not exists environment text default 'practice',
  add column if not exists duration_seconds numeric default 0,
  add column if not exists status text default 'stored',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.axis_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.axis_session_analysis
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.axis_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.axis_sessions(id) on delete cascade,
  bucket_id text not null default 'axis-replays',
  file_path text not null,
  file_name text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.axis_behavioral_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.axis_sessions(id) on delete cascade,
  memory_type text not null,
  label text,
  confidence numeric,
  occurred_at_seconds numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists axis_profiles_user_id_idx
  on public.axis_profiles(user_id);

create index if not exists axis_sessions_user_id_created_at_idx
  on public.axis_sessions(user_id, created_at desc);

create index if not exists axis_sessions_file_path_idx
  on public.axis_sessions(file_path);

create index if not exists axis_events_session_id_idx
  on public.axis_events(session_id);

create index if not exists axis_session_analysis_session_id_idx
  on public.axis_session_analysis(session_id);

create index if not exists axis_uploads_user_id_idx
  on public.axis_uploads(user_id);

create index if not exists axis_behavioral_memory_user_session_idx
  on public.axis_behavioral_memory(user_id, session_id);

alter table public.axis_profiles enable row level security;
alter table public.axis_sessions enable row level security;
alter table public.axis_events enable row level security;
alter table public.axis_session_analysis enable row level security;
alter table public.axis_uploads enable row level security;
alter table public.axis_behavioral_memory enable row level security;

drop policy if exists "Profiles are owned by user" on public.axis_profiles;
create policy "Profiles are owned by user"
  on public.axis_profiles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Replay sessions are owned by user" on public.axis_sessions;
create policy "Replay sessions are owned by user"
  on public.axis_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Axis events follow session ownership" on public.axis_events;
create policy "Axis events follow session ownership"
  on public.axis_events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.axis_sessions s
      where s.id = axis_events.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.axis_sessions s
      where s.id = axis_events.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Axis analysis follows session ownership" on public.axis_session_analysis;
create policy "Axis analysis follows session ownership"
  on public.axis_session_analysis
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.axis_sessions s
      where s.id = axis_session_analysis.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.axis_sessions s
      where s.id = axis_session_analysis.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Uploads are owned by user" on public.axis_uploads;
create policy "Uploads are owned by user"
  on public.axis_uploads
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Behavioral memory is owned by user" on public.axis_behavioral_memory;
create policy "Behavioral memory is owned by user"
  on public.axis_behavioral_memory
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('axis-replays', 'axis-replays', false)
on conflict (id) do nothing;

drop policy if exists "Users read own replay objects" on storage.objects;
create policy "Users read own replay objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'axis-replays'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users insert own replay objects" on storage.objects;
create policy "Users insert own replay objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'axis-replays'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update own replay objects" on storage.objects;
create policy "Users update own replay objects"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'axis-replays'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'axis-replays'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
