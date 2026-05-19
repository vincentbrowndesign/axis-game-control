alter table public.snapshots
  add column if not exists annotation text;

drop policy if exists "operators can update own snapshots" on public.snapshots;
create policy "operators can update own snapshots"
  on public.snapshots for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = snapshots.session_id
        and sessions.operator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id = snapshots.session_id
        and sessions.operator_id = auth.uid()
    )
  );
