alter table public.axis_video_jobs
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists organization_id uuid,
  add column if not exists session_id text,
  add column if not exists video_id text;

alter table public.axis_artifacts
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists organization_id uuid,
  add column if not exists session_id text,
  add column if not exists video_id text;

alter table public.axis_exports
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists organization_id uuid,
  add column if not exists session_id text,
  add column if not exists video_id text;

alter table public.axis_artifact_facts
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists organization_id uuid,
  add column if not exists session_id text,
  add column if not exists video_id text;

alter table public.axis_entity_tracks
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists organization_id uuid,
  add column if not exists session_id text,
  add column if not exists video_id text;

create index if not exists axis_video_jobs_user_created_idx
  on public.axis_video_jobs (user_id, created_at desc);

create index if not exists axis_video_jobs_org_created_idx
  on public.axis_video_jobs (organization_id, created_at desc);

create index if not exists axis_video_jobs_session_id_idx
  on public.axis_video_jobs (session_id);

create index if not exists axis_video_jobs_cloudflare_uid_idx
  on public.axis_video_jobs (cloudflare_uid);

create index if not exists axis_entity_tracks_upload_entity_created_idx
  on public.axis_entity_tracks (upload_id, entity_type, created_at);

create index if not exists axis_artifacts_user_created_idx
  on public.axis_artifacts (user_id, created_at desc);

create index if not exists axis_artifacts_org_created_idx
  on public.axis_artifacts (organization_id, created_at desc);

create index if not exists axis_artifacts_session_id_idx
  on public.axis_artifacts (session_id);

create index if not exists axis_exports_user_created_idx
  on public.axis_exports (user_id, created_at desc);

create index if not exists axis_exports_org_created_idx
  on public.axis_exports (organization_id, created_at desc);

create index if not exists axis_artifact_facts_user_created_idx
  on public.axis_artifact_facts (user_id, created_at desc);

create index if not exists axis_artifact_facts_session_id_idx
  on public.axis_artifact_facts (session_id);
