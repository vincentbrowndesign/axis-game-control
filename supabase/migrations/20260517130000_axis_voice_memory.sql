alter table public.axis_sessions
  add column if not exists session_transcript text,
  add column if not exists behavior_clusters jsonb not null default '[]'::jsonb,
  add column if not exists ai_phrase_summary text,
  add column if not exists clip_phrase_links jsonb not null default '[]'::jsonb;

create table if not exists public.axis_voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.axis_sessions(id) on delete cascade,
  phrase text not null,
  normalized_phrase text,
  workflow_stage text,
  occurred_at_seconds numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.axis_clip_phrase_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.axis_sessions(id) on delete cascade,
  phrase_id uuid references public.axis_voice_notes(id) on delete cascade,
  confidence numeric not null default 0.75,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists axis_sessions_behavior_clusters_idx
  on public.axis_sessions using gin(behavior_clusters);

create index if not exists axis_voice_notes_user_created_at_idx
  on public.axis_voice_notes(user_id, created_at desc);

create index if not exists axis_voice_notes_session_id_idx
  on public.axis_voice_notes(session_id);

create index if not exists axis_voice_notes_normalized_phrase_idx
  on public.axis_voice_notes(normalized_phrase);

create index if not exists axis_clip_phrase_links_session_id_idx
  on public.axis_clip_phrase_links(session_id);

create index if not exists axis_clip_phrase_links_phrase_id_idx
  on public.axis_clip_phrase_links(phrase_id);

alter table public.axis_voice_notes enable row level security;
alter table public.axis_clip_phrase_links enable row level security;

grant select, insert, update, delete on public.axis_voice_notes to authenticated;
grant select, insert, update, delete on public.axis_clip_phrase_links to authenticated;

drop policy if exists "Voice notes are owned by user" on public.axis_voice_notes;
create policy "Voice notes are owned by user"
  on public.axis_voice_notes
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Clip phrase links are owned by user" on public.axis_clip_phrase_links;
create policy "Clip phrase links are owned by user"
  on public.axis_clip_phrase_links
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
