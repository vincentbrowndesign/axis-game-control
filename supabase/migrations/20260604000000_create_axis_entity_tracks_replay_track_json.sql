do $$
begin
  if to_regclass('public.axis_entity_tracks') is not null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'axis_entity_tracks'
        and column_name = 'track'
    )
  then
    alter table public.axis_entity_tracks
      rename to axis_entity_tracks_legacy_20260604;
  end if;
end $$;

create table if not exists public.axis_entity_tracks (
  id uuid primary key default gen_random_uuid(),
  upload_id text not null,
  entity_type text not null,
  track jsonb not null,
  source text,
  confidence numeric,
  metadata jsonb,
  created_at timestamptz default now()
);

do $$
begin
  if to_regclass('public.axis_entity_tracks_legacy_20260604') is not null then
    execute $copy$
      insert into public.axis_entity_tracks (
        upload_id,
        entity_type,
        track,
        source,
        confidence,
        metadata,
        created_at
      )
      select
        legacy.upload_id,
        legacy.entity_type,
        jsonb_build_object(
          'artifact_id', legacy.artifact_id,
          'entity_id', legacy.entity_id,
          'entity_type', legacy.entity_type,
          'frame', legacy.frame,
          'x', legacy.x,
          'y', legacy.y
        ),
        'legacy_axis_entity_tracks',
        null,
        jsonb_build_object('track_id', legacy.track_id),
        legacy.created_at
      from public.axis_entity_tracks_legacy_20260604 legacy
      where not exists (
        select 1
        from public.axis_entity_tracks current
        where current.upload_id = legacy.upload_id
          and current.entity_type = legacy.entity_type
          and (current.track->>'entity_id') = legacy.entity_id
          and (current.track->>'frame')::integer = legacy.frame
      )
    $copy$;
  end if;
end $$;

create index if not exists axis_entity_tracks_upload_id_idx
  on public.axis_entity_tracks (upload_id);

create index if not exists axis_entity_tracks_entity_type_idx
  on public.axis_entity_tracks (entity_type);

create index if not exists axis_entity_tracks_created_at_desc_idx
  on public.axis_entity_tracks (created_at desc);
