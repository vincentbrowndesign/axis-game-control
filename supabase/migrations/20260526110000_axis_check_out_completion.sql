alter table public.axis_training_check_ins
  add column if not exists checked_out_at timestamptz,
  add column if not exists reflection text;

create index if not exists axis_training_check_ins_checkout_idx
  on public.axis_training_check_ins(checked_out_at desc)
  where checked_out_at is not null;
