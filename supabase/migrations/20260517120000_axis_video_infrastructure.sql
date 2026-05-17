alter table public.axis_sessions
  add column if not exists player_id text,
  add column if not exists behavior_sentence text,
  add column if not exists mux_asset_id text,
  add column if not exists mux_playback_id text,
  add column if not exists transcript_text text,
  add column if not exists ai_summary text,
  add column if not exists embedding_status text not null default 'pending',
  add column if not exists semantic_tags text[] not null default '{}'::text[];

alter table public.axis_sessions
  add column if not exists playback_id text,
  add column if not exists asset_id text,
  add column if not exists upload_id text,
  add column if not exists video_url text,
  add column if not exists title text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists axis_sessions_mux_asset_id_idx
  on public.axis_sessions(mux_asset_id);

create index if not exists axis_sessions_mux_playback_id_idx
  on public.axis_sessions(mux_playback_id);

create index if not exists axis_sessions_status_idx
  on public.axis_sessions(status);

create index if not exists axis_sessions_player_id_idx
  on public.axis_sessions(player_id);

create index if not exists axis_sessions_behavior_sentence_idx
  on public.axis_sessions using gin(to_tsvector('english', coalesce(behavior_sentence, '')));

create index if not exists axis_sessions_semantic_tags_idx
  on public.axis_sessions using gin(semantic_tags);
