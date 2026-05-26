alter table public.axis_organizations
  add column if not exists logo text;

update public.axis_organizations
set logo = avatar
where logo is null and avatar is not null;

alter table public.axis_organization_memberships
  add column if not exists joined_at timestamptz;

update public.axis_organization_memberships
set joined_at = created_at
where joined_at is null;

alter table public.axis_organization_memberships
  alter column joined_at set default now();

alter table public.axis_organization_memberships
  drop constraint if exists axis_organization_memberships_role_check;

alter table public.axis_organization_memberships
  add constraint axis_organization_memberships_role_check check (
    role in ('player', 'coach', 'admin', 'organization_owner', 'parent', 'owner')
  );

alter table public.axis_organization_invites
  drop constraint if exists axis_organization_invites_role_check;

alter table public.axis_organization_invites
  add constraint axis_organization_invites_role_check check (
    role in ('player', 'coach', 'admin', 'organization_owner', 'parent', 'owner')
  );

create or replace view public.organizations
with (security_invoker = true)
as
select
  id,
  slug,
  name,
  coalesce(logo, avatar) as logo,
  created_at
from public.axis_organizations
where status = 'active';

create or replace view public.organization_members
with (security_invoker = true)
as
select
  id,
  organization_id,
  user_id,
  role,
  coalesce(joined_at, created_at) as joined_at
from public.axis_organization_memberships
where status = 'active';

grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;

insert into public.axis_organizations (name, slug, avatar, logo)
values
  ('BTC', 'btc', 'B', 'B'),
  ('Bridge', 'bridge', 'BR', 'BR'),
  ('City 2 City', 'city2city', 'C2', 'C2')
on conflict (slug) do update
set
  avatar = excluded.avatar,
  logo = excluded.logo,
  name = excluded.name,
  updated_at = now();
