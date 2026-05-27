create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  organization_slug text not null,
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists check_ins_user_org_checked_in_idx
  on public.check_ins(user_id, organization_slug, checked_in_at desc);

alter table public.check_ins enable row level security;
