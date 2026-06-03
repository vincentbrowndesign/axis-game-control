create table if not exists public.axis_artifacts (
  artifact_id text primary key,
  upload_id text not null,
  artifact_type text not null,
  artifact_title text not null,
  artifact_body text not null,
  source_clip_count integer not null default 1 check (source_clip_count >= 0),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists axis_artifacts_upload_id_idx
  on public.axis_artifacts (upload_id);

create index if not exists axis_artifacts_created_at_idx
  on public.axis_artifacts (created_at desc);

create table if not exists public.axis_exports (
  export_id text primary key,
  artifact_id text not null references public.axis_artifacts (artifact_id) on delete cascade,
  export_type text not null,
  destination text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists axis_exports_artifact_id_idx
  on public.axis_exports (artifact_id);

create index if not exists axis_exports_created_at_idx
  on public.axis_exports (created_at desc);

alter table public.axis_artifacts enable row level security;
alter table public.axis_exports enable row level security;
