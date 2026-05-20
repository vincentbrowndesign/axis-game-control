insert into storage.buckets (id, name, public)
values ('training-frames', 'training-frames', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.training_memories (
  id uuid primary key,
  session_id text not null,
  label text not null,
  frame_url text not null,
  video_url text,
  replay_time numeric not null default 0,
  clip_start numeric,
  clip_end numeric,
  event_type text,
  metadata jsonb not null default '{}'::jsonb,
  roboflow_status text not null default 'pending',
  roboflow_response jsonb,
  created_at timestamp not null default now()
);

create index if not exists training_memories_session_time_idx
  on public.training_memories(session_id, replay_time);

create index if not exists training_memories_created_at_idx
  on public.training_memories(created_at desc);

create index if not exists training_memories_roboflow_status_idx
  on public.training_memories(roboflow_status);

alter table public.training_memories enable row level security;

drop policy if exists "operators can read own training memories" on public.training_memories;
create policy "operators can read own training memories"
  on public.training_memories for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id::text = training_memories.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can create own training memories" on public.training_memories;
create policy "operators can create own training memories"
  on public.training_memories for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id::text = training_memories.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can update own training memories" on public.training_memories;
create policy "operators can update own training memories"
  on public.training_memories for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id::text = training_memories.session_id
        and sessions.operator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id::text = training_memories.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can delete own training memories" on public.training_memories;
create policy "operators can delete own training memories"
  on public.training_memories for delete
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id::text = training_memories.session_id
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can read own training frame objects" on storage.objects;
create policy "operators can read own training frame objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-frames'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can write own training frame objects" on storage.objects;
create policy "operators can write own training frame objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-frames'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can delete own training frame objects" on storage.objects;
create policy "operators can delete own training frame objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-frames'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );
