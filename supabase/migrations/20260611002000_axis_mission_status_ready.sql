alter table public.axis_missions
  drop constraint if exists axis_missions_status_check;

alter table public.axis_missions
  alter column status set default 'READY';

update public.axis_missions
  set status = 'READY'
  where status is distinct from 'READY';

alter table public.axis_missions
  add constraint axis_missions_status_check
  check (status = 'READY');

alter table public.axis_attempts
  drop constraint if exists axis_attempts_status_check;

update public.axis_attempts
  set status = 'EVALUATED'
  where status in ('READY', 'COMPLETE', 'FAILED');

alter table public.axis_attempts
  add constraint axis_attempts_status_check
  check (status in ('ACTIVE', 'PAUSED', 'ENDED', 'EVALUATED'));

alter table public.axis_sessions
  drop constraint if exists axis_sessions_status_check;

alter table public.axis_sessions
  alter column status set default 'ACTIVE';

update public.axis_sessions
  set status = 'ACTIVE'
  where status = 'READY';

alter table public.axis_sessions
  add constraint axis_sessions_status_check
  check (status in ('ACTIVE', 'PAUSED', 'ENDED', 'EVALUATED'));
