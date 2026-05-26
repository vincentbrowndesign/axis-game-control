create table if not exists public.axis_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  avatar text,
  status text not null default 'active',
  leaderboard_enabled boolean not null default true,
  home_sessions_enabled boolean not null default false,
  nfc_enabled boolean not null default false,
  qr_stations_enabled boolean not null default false,
  location_verification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_organizations_slug_check check (
    slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'
  )
);

create table if not exists public.axis_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.axis_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  clerk_user_id text,
  role text not null default 'player',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_organization_memberships_owner_check check (
    user_id is not null or clerk_user_id is not null
  ),
  constraint axis_organization_memberships_role_check check (
    role in ('player', 'coach', 'admin', 'parent', 'owner')
  )
);

create table if not exists public.axis_organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.axis_organizations(id) on delete cascade,
  invite_token uuid not null default gen_random_uuid() unique,
  email text not null,
  role text not null default 'player',
  status text not null default 'pending',
  invited_by_user_id uuid references auth.users(id) on delete set null,
  invited_by_clerk_user_id text,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_by_clerk_user_id text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint axis_organization_invites_role_check check (
    role in ('player', 'coach', 'admin', 'parent', 'owner')
  ),
  constraint axis_organization_invites_status_check check (
    status in ('pending', 'accepted', 'revoked')
  )
);

create unique index if not exists axis_org_memberships_user_unique_idx
  on public.axis_organization_memberships(organization_id, user_id)
  where user_id is not null;

create unique index if not exists axis_org_memberships_clerk_unique_idx
  on public.axis_organization_memberships(organization_id, clerk_user_id)
  where clerk_user_id is not null;

create index if not exists axis_org_memberships_org_idx
  on public.axis_organization_memberships(organization_id, status);

create unique index if not exists axis_org_invites_pending_email_idx
  on public.axis_organization_invites(organization_id, lower(email))
  where status = 'pending';

create index if not exists axis_org_invites_org_idx
  on public.axis_organization_invites(organization_id, status, created_at desc);

create index if not exists axis_org_invites_token_idx
  on public.axis_organization_invites(invite_token, status);

alter table public.axis_training_check_ins
  add column if not exists organization_id uuid references public.axis_organizations(id) on delete set null;

create index if not exists axis_training_check_ins_org_occurred_idx
  on public.axis_training_check_ins(organization_id, occurred_at desc);

alter table public.axis_organizations enable row level security;
alter table public.axis_organization_memberships enable row level security;
alter table public.axis_organization_invites enable row level security;

grant select, update on public.axis_organizations to authenticated;
grant select, insert, update on public.axis_organization_memberships to authenticated;
grant select, insert, update on public.axis_organization_invites to authenticated;

drop policy if exists "Active organizations are readable" on public.axis_organizations;
create policy "Active organizations are readable"
  on public.axis_organizations
  for select
  to authenticated
  using (status = 'active');

drop policy if exists "Memberships are readable by Supabase owner" on public.axis_organization_memberships;
create policy "Memberships are readable by Supabase owner"
  on public.axis_organization_memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Memberships are writable by Supabase owner" on public.axis_organization_memberships;
create policy "Memberships are writable by Supabase owner"
  on public.axis_organization_memberships
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Organization invites are readable by inviter" on public.axis_organization_invites;
create policy "Organization invites are readable by inviter"
  on public.axis_organization_invites
  for select
  to authenticated
  using ((select auth.uid()) = invited_by_user_id);

drop policy if exists "Organization invites are writable by inviter" on public.axis_organization_invites;
create policy "Organization invites are writable by inviter"
  on public.axis_organization_invites
  for insert
  to authenticated
  with check ((select auth.uid()) = invited_by_user_id);

insert into public.axis_organizations (name, slug, avatar)
values
  ('BTC', 'btc', 'B'),
  ('Bridge', 'bridge', 'BR'),
  ('City 2 City', 'city2city', 'C2')
on conflict (slug) do update
set
  avatar = excluded.avatar,
  name = excluded.name,
  updated_at = now();
