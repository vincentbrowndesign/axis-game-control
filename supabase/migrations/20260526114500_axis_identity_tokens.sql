create table if not exists public.axis_identity_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  token_type text not null default 'qr',
  organization_id uuid references public.axis_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  clerk_user_id text,
  label text not null default 'Axis tag',
  status text not null default 'active',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_identity_tokens_owner_check check (
    user_id is not null or clerk_user_id is not null
  ),
  constraint axis_identity_tokens_type_check check (
    token_type in ('qr', 'nfc')
  ),
  constraint axis_identity_tokens_status_check check (
    status in ('active', 'paused', 'revoked')
  )
);

alter table public.axis_training_check_ins
  add column if not exists identity_token_id uuid references public.axis_identity_tokens(id) on delete set null;

create index if not exists axis_identity_tokens_token_idx
  on public.axis_identity_tokens(token)
  where status = 'active';

create index if not exists axis_identity_tokens_owner_idx
  on public.axis_identity_tokens(user_id, clerk_user_id, status);

create index if not exists axis_identity_tokens_org_idx
  on public.axis_identity_tokens(organization_id, status);

create index if not exists axis_training_check_ins_identity_token_idx
  on public.axis_training_check_ins(identity_token_id, occurred_at desc)
  where identity_token_id is not null;

alter table public.axis_identity_tokens enable row level security;

grant select, insert, update on public.axis_identity_tokens to authenticated;

drop policy if exists "Identity tokens are readable by Supabase owner" on public.axis_identity_tokens;
create policy "Identity tokens are readable by Supabase owner"
  on public.axis_identity_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Identity tokens are writable by Supabase owner" on public.axis_identity_tokens;
create policy "Identity tokens are writable by Supabase owner"
  on public.axis_identity_tokens
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
