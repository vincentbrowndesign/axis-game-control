create table if not exists public.axis_artifact_facts (
  fact_id text primary key,
  artifact_id text not null references public.axis_artifacts (artifact_id) on delete cascade,
  upload_id text not null,
  fact_key text not null,
  fact_label text not null,
  fact_value numeric not null,
  fact_unit text not null,
  sample_size integer not null default 0 check (sample_size >= 0),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists axis_artifact_facts_artifact_id_idx
  on public.axis_artifact_facts (artifact_id);

create index if not exists axis_artifact_facts_upload_key_created_idx
  on public.axis_artifact_facts (upload_id, fact_key, created_at desc);

alter table public.axis_artifact_facts enable row level security;
