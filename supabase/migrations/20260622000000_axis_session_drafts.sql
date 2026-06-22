create extension if not exists pgcrypto;

create table if not exists public.axis_session_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  player_name text,
  player_id text,
  session_type text not null
    check (session_type in ('training', 'game', 'film', 'practice', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'processing', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_axis_session_drafts_owner_updated
  on public.axis_session_drafts(owner_id, updated_at desc);

alter table public.axis_session_drafts enable row level security;

drop policy if exists "axis_session_drafts_owner_select" on public.axis_session_drafts;
drop policy if exists "axis_session_drafts_owner_insert" on public.axis_session_drafts;
drop policy if exists "axis_session_drafts_owner_update" on public.axis_session_drafts;
drop policy if exists "axis_session_drafts_owner_delete" on public.axis_session_drafts;

create policy "axis_session_drafts_owner_select"
  on public.axis_session_drafts
  for select
  using (auth.uid() = owner_id);

create policy "axis_session_drafts_owner_insert"
  on public.axis_session_drafts
  for insert
  with check (auth.uid() = owner_id);

create policy "axis_session_drafts_owner_update"
  on public.axis_session_drafts
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "axis_session_drafts_owner_delete"
  on public.axis_session_drafts
  for delete
  using (auth.uid() = owner_id);

grant select, insert, update, delete on public.axis_session_drafts to authenticated;
