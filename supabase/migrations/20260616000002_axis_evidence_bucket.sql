-- Add file reference columns to evidence table
alter table axis_thread_evidence
  add column if not exists url       text,
  add column if not exists file_name text,
  add column if not exists file_path text;

-- Create Supabase Storage bucket for evidence files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'axis-evidence',
  'axis-evidence',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ]
)
on conflict (id) do nothing;

-- Allow all users (anon + authenticated) to upload and read evidence files
create policy "axis_evidence_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'axis-evidence');

create policy "axis_evidence_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'axis-evidence');
