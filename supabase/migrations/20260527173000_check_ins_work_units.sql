alter table public.check_ins
  add column if not exists work_units jsonb not null default '[]'::jsonb;

alter table public.check_ins
  drop constraint if exists check_ins_work_units_is_array,
  add constraint check_ins_work_units_is_array
    check (jsonb_typeof(work_units) = 'array');
