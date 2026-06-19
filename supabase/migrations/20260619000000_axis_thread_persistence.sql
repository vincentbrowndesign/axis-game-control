-- Axis Thread Persistence v0
-- Saves exact Axis conversation threads and assistant Thread Board snapshots.
-- This migration layers the MVP owner_id boundary onto the existing legacy
-- axis_threads table without deleting preserved legacy columns.

create extension if not exists pgcrypto;

alter table axis_threads
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists last_opened_at timestamptz,
  add column if not exists archived_at timestamptz;

update axis_threads
set owner_id = user_id
where owner_id is null
  and user_id is not null;

update axis_threads
set title = 'Untitled Axis Thread'
where title is null;

alter table axis_threads
  alter column title set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table axis_threads
  drop constraint if exists axis_threads_owner_id_required,
  add constraint axis_threads_owner_id_required
    check (owner_id is not null) not valid;

create table if not exists axis_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references axis_threads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  thread_board jsonb,
  created_at timestamptz not null default now(),
  unique (thread_id, ordinal)
);

create index if not exists idx_axis_threads_owner_updated
  on axis_threads(owner_id, updated_at desc)
  where archived_at is null;

create index if not exists idx_axis_thread_messages_owner_thread_ordinal
  on axis_thread_messages(owner_id, thread_id, ordinal);

alter table axis_threads enable row level security;
alter table axis_thread_messages enable row level security;

drop policy if exists "axis_threads_owner_select" on axis_threads;
drop policy if exists "axis_threads_owner_insert" on axis_threads;
drop policy if exists "axis_threads_owner_update" on axis_threads;
drop policy if exists "axis_threads_owner_delete" on axis_threads;

create policy "axis_threads_owner_select"
  on axis_threads
  for select
  using (auth.uid() = owner_id);

create policy "axis_threads_owner_insert"
  on axis_threads
  for insert
  with check (auth.uid() = owner_id);

create policy "axis_threads_owner_update"
  on axis_threads
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "axis_threads_owner_delete"
  on axis_threads
  for delete
  using (auth.uid() = owner_id);

drop policy if exists "axis_thread_messages_owner_select" on axis_thread_messages;
drop policy if exists "axis_thread_messages_owner_insert" on axis_thread_messages;
drop policy if exists "axis_thread_messages_owner_update" on axis_thread_messages;
drop policy if exists "axis_thread_messages_owner_delete" on axis_thread_messages;

create policy "axis_thread_messages_owner_select"
  on axis_thread_messages
  for select
  using (auth.uid() = owner_id);

create policy "axis_thread_messages_owner_insert"
  on axis_thread_messages
  for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from axis_threads
      where axis_threads.id = axis_thread_messages.thread_id
        and axis_threads.owner_id = auth.uid()
    )
  );

create policy "axis_thread_messages_owner_update"
  on axis_thread_messages
  for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from axis_threads
      where axis_threads.id = axis_thread_messages.thread_id
        and axis_threads.owner_id = auth.uid()
    )
  );

create policy "axis_thread_messages_owner_delete"
  on axis_thread_messages
  for delete
  using (auth.uid() = owner_id);

grant select, insert, update, delete on axis_threads to authenticated;
grant select, insert, update, delete on axis_thread_messages to authenticated;
