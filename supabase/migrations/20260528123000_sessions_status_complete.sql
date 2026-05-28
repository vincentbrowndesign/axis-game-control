alter table public.sessions
  drop constraint if exists sessions_status_valid,
  add constraint sessions_status_valid
    check (status in ('active', 'complete'));
