alter table public.axis_session_drafts
  add column if not exists focus text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists moments jsonb not null default '[]'::jsonb,
  add column if not exists summary text,
  add column if not exists next_session_card jsonb,
  add column if not exists searchable_text text,
  add column if not exists source text default 'mixed';

create index if not exists idx_axis_session_drafts_owner_started
  on public.axis_session_drafts(owner_id, started_at desc);
