alter table public.axis_organization_invites
  add column if not exists invite_code text;

alter table public.axis_organization_invites
  alter column email drop not null;

create unique index if not exists axis_org_invites_pending_code_idx
  on public.axis_organization_invites(lower(invite_code))
  where invite_code is not null and status = 'pending';

create index if not exists axis_org_invites_code_status_idx
  on public.axis_organization_invites(invite_code, status);

update public.axis_organizations
set
  status = 'archived',
  updated_at = now()
where slug = 'btc';

insert into public.axis_organizations (name, slug, avatar, logo, status)
values
  ('Bridge', 'bridge', 'BR', 'BR', 'active'),
  ('City 2 City', 'city2city', 'C2', 'C2', 'active')
on conflict (slug) do update
set
  avatar = excluded.avatar,
  logo = excluded.logo,
  name = excluded.name,
  status = 'active',
  updated_at = now();

insert into public.axis_organization_invites (
  organization_id,
  invite_code,
  email,
  role,
  status
)
select
  organization.id,
  seed.code,
  null,
  'player',
  'pending'
from (
  values
    ('bridge', 'BRIDGE2025'),
    ('city2city', 'CITY2CITY2025')
) as seed(slug, code)
join public.axis_organizations organization
  on organization.slug = seed.slug
where not exists (
  select 1
  from public.axis_organization_invites existing
  where lower(existing.invite_code) = lower(seed.code)
    and existing.status = 'pending'
);
