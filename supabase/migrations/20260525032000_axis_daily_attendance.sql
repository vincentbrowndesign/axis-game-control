create table if not exists public.axis_training_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  clerk_user_id text,
  status text not null default 'checked_in',
  workout_type text not null default 'Training',
  duration_minutes integer not null default 0,
  notes text,
  latitude double precision not null,
  longitude double precision not null,
  distance_meters double precision not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_training_check_ins_owner_check check (
    user_id is not null or clerk_user_id is not null
  ),
  constraint axis_training_check_ins_duration_check check (
    duration_minutes >= 0 and duration_minutes <= 600
  )
);

create index if not exists axis_training_check_ins_user_occurred_idx
  on public.axis_training_check_ins(user_id, occurred_at desc);

create index if not exists axis_training_check_ins_clerk_occurred_idx
  on public.axis_training_check_ins(clerk_user_id, occurred_at desc);

alter table public.axis_training_check_ins enable row level security;

grant select, insert, update on public.axis_training_check_ins to authenticated;

drop policy if exists "Training check-ins are owned by Supabase user" on public.axis_training_check_ins;
create policy "Training check-ins are owned by Supabase user"
  on public.axis_training_check_ins
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
