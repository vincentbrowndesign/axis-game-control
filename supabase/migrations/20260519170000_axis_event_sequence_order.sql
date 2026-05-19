alter table public.events
  add column if not exists sequence_order bigint not null default 0;

create index if not exists events_chronology_order_idx
  on public.events(session_id, session_time, sequence_order, created_at);
