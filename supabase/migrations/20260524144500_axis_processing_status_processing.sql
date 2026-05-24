alter table public.axis_processing_jobs
  drop constraint if exists axis_processing_jobs_status_check;

alter table public.axis_processing_jobs
  add constraint axis_processing_jobs_status_check check (
    status in ('queued', 'processing', 'complete', 'failed', 'waiting')
  );
