alter table public.axis_sessions
  add column if not exists tags text[] not null default '{}';

create index if not exists axis_sessions_tags_idx
  on public.axis_sessions using gin(tags);
