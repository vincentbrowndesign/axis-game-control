create table if not exists public.axis_entity_tracks (
  track_id text primary key,
  artifact_id text not null references public.axis_artifacts (artifact_id) on delete cascade,
  upload_id text not null,
  entity_id text not null,
  entity_type text not null check (entity_type in ('player', 'ball', 'hoop')),
  frame integer not null check (frame >= 0),
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists axis_entity_tracks_upload_frame_idx
  on public.axis_entity_tracks (upload_id, frame);

create index if not exists axis_entity_tracks_upload_entity_idx
  on public.axis_entity_tracks (upload_id, entity_id, frame);

create index if not exists axis_entity_tracks_artifact_id_idx
  on public.axis_entity_tracks (artifact_id);

alter table public.axis_entity_tracks enable row level security;
