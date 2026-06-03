alter table public.axis_artifact_facts
  add column if not exists source text,
  add column if not exists support_level text,
  add column if not exists verification_status text;

alter table public.axis_artifact_facts
  add constraint axis_artifact_facts_support_level_check
  check (support_level is null or support_level in ('strong', 'medium', 'weak')) not valid;

alter table public.axis_artifact_facts
  add constraint axis_artifact_facts_verification_status_check
  check (verification_status is null or verification_status in ('accepted', 'needs_review', 'rejected')) not valid;
