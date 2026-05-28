do $$
declare
  has_legacy_sessions boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name in ('operator_id', 'playback_url', 'storage_path')
  )
  into has_legacy_sessions;

  if has_legacy_sessions and to_regclass('public.sessions_legacy_media_20260528') is null then
    alter table public.sessions rename to sessions_legacy_media_20260528;
  end if;
end $$;

create table if not exists public.sessions (
  id uuid default gen_random_uuid() constraint sessions_v1_pkey primary key,
  user_id text not null,
  organization_slug text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint sessions_duration_seconds_nonnegative
    check (duration_seconds >= 0),
  constraint sessions_status_valid
    check (status in ('active', 'complete'))
);

create index if not exists sessions_v1_user_org_started_idx
  on public.sessions(user_id, organization_slug, started_at desc);

create index if not exists sessions_v1_org_started_idx
  on public.sessions(organization_slug, started_at desc);

alter table public.sessions enable row level security;

grant select, insert, update on public.sessions to authenticated;
grant select, insert, update on public.sessions to service_role;
