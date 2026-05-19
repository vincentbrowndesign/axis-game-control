insert into storage.buckets (id, name, public)
values
  ('session-archives', 'session-archives', false),
  ('session-snapshots', 'session-snapshots', true)
on conflict (id) do update
set public = excluded.public;

create index if not exists events_session_time_lookup_idx
  on public.events(session_id, session_time);

create index if not exists snapshots_session_time_lookup_idx
  on public.snapshots(session_id, session_time);

drop policy if exists "operators can read own session snapshots objects" on storage.objects;
create policy "operators can read own session snapshots objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'session-snapshots'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can write own session snapshots objects" on storage.objects;
create policy "operators can write own session snapshots objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'session-snapshots'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );

drop policy if exists "operators can update own session snapshots objects" on storage.objects;
create policy "operators can update own session snapshots objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'session-snapshots'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'session-snapshots'
    and exists (
      select 1
      from public.sessions
      where sessions.id::text = (storage.foldername(name))[1]
        and sessions.operator_id = auth.uid()
    )
  );
