alter table public.check_ins
  add column if not exists checked_out_at timestamptz,
  add column if not exists duration_minutes integer not null default 0;

alter table public.check_ins
  drop constraint if exists check_ins_duration_minutes_range,
  add constraint check_ins_duration_minutes_range
    check (duration_minutes >= 0 and duration_minutes <= 600);

create index if not exists check_ins_checked_out_idx
  on public.check_ins(checked_out_at desc)
  where checked_out_at is not null;
