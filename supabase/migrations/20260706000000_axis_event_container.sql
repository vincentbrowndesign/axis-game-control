-- Axis Event Container v0.1
-- Company: Trophy Labs
-- Product: Axis
-- Purpose: Create the minimum database layer for event -> media -> moments -> reports -> access -> memory.
--
-- Note: the container table is named axis_event_containers because axis_events
-- already exists in this project (semantic CV movement events,
-- 20260606100000_axis_events.sql) with an incompatible schema.

create extension if not exists pgcrypto;

create table if not exists axis_event_containers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null check (event_type in (
    'game',
    'practice',
    'training',
    'small_group',
    'private',
    'film_review',
    'calibrate',
    'clinic',
    'other'
  )),
  source_mode text not null default 'attach_video' check (source_mode in (
    'record_now',
    'attach_video',
    'attach_stream'
  )),
  status text not null default 'draft' check (status in (
    'draft',
    'recording',
    'live',
    'review',
    'processing',
    'ready',
    'archived'
  )),
  location text,
  team_name text,
  opponent_name text,
  created_by uuid,
  notes text,
  -- Set when the live marker screen goes live so KEEP/FIX timestamps survive reloads.
  recording_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists axis_event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references axis_event_containers(id) on delete cascade,
  kind text not null check (kind in (
    'recording',
    'upload',
    'stream',
    'replay',
    'clip',
    'thumbnail',
    'frame'
  )),
  provider text,
  url text,
  storage_path text,
  upload_status text not null default 'pending' check (upload_status in (
    'pending',
    'uploading',
    'processing',
    'ready',
    'failed'
  )),
  duration_seconds numeric,
  width int,
  height int,
  fps numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists axis_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  team_name text,
  jersey_number text,
  graduation_year text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists axis_event_players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references axis_event_containers(id) on delete cascade,
  player_id uuid references axis_players(id) on delete set null,
  display_name text not null,
  team_name text,
  jersey_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists axis_moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references axis_event_containers(id) on delete cascade,
  player_id uuid references axis_players(id) on delete set null,
  event_player_id uuid references axis_event_players(id) on delete set null,
  timestamp_seconds numeric not null default 0,
  intent text not null check (intent in ('asset', 'coaching')),
  ui_label text not null check (ui_label in ('KEEP', 'FIX')),
  note text,
  voice_note_url text,
  transcript text,
  lens_tags text[] not null default '{}',
  outcome_tags text[] not null default '{}',
  output_targets text[] not null default '{}',
  source text not null default 'manual',
  confidence numeric,
  worker_status jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists axis_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references axis_event_containers(id) on delete cascade,
  player_id uuid references axis_players(id) on delete set null,
  report_type text not null default 'summary' check (report_type in (
    'summary',
    'player',
    'team',
    'calibrate',
    'sponsor',
    'parent'
  )),
  title text,
  summary text,
  evidence jsonb not null default '[]'::jsonb,
  strengths text[] not null default '{}',
  corrections text[] not null default '{}',
  next_focus text,
  status text not null default 'draft' check (status in (
    'draft',
    'ready',
    'sent',
    'archived'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists axis_access_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references axis_event_containers(id) on delete cascade,
  player_id uuid references axis_players(id) on delete set null,
  report_id uuid references axis_reports(id) on delete set null,
  label text not null,
  target_type text not null default 'event' check (target_type in (
    'event',
    'replay',
    'clip_pack',
    'report',
    'media_pass',
    'sponsor',
    'training_offer'
  )),
  provider text,
  url text not null,
  price_cents int,
  access_level text not null default 'paid' check (access_level in (
    'free',
    'paid',
    'private',
    'team',
    'player',
    'sponsor'
  )),
  status text not null default 'active' check (status in (
    'active',
    'inactive',
    'archived'
  )),
  created_at timestamptz not null default now()
);

create index if not exists axis_event_media_event_id_idx on axis_event_media(event_id);
create index if not exists axis_event_players_event_id_idx on axis_event_players(event_id);
create index if not exists axis_event_players_player_id_idx on axis_event_players(player_id);
create index if not exists axis_moments_event_id_idx on axis_moments(event_id);
create index if not exists axis_moments_player_id_idx on axis_moments(player_id);
create index if not exists axis_reports_event_id_idx on axis_reports(event_id);
create index if not exists axis_access_links_event_id_idx on axis_access_links(event_id);

-- Optional RLS starter. Keep policies conservative until auth/org ownership is finalized.
-- RLS enabled with no policies: all reads/writes go through server routes using the
-- service role key (src/lib/axis-supabase-server.ts pattern).
alter table axis_event_containers enable row level security;
alter table axis_event_media enable row level security;
alter table axis_players enable row level security;
alter table axis_event_players enable row level security;
alter table axis_moments enable row level security;
alter table axis_reports enable row level security;
alter table axis_access_links enable row level security;
