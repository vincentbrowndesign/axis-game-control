create table if not exists public.axis_decoder_tests (
  test_id text primary key,
  upload_id text not null,
  mux_playback_id text,
  expected jsonb not null,
  decoded jsonb not null,
  wrong jsonb not null default '[]'::jsonb,
  missing jsonb not null default '[]'::jsonb,
  total integer not null,
  correct integer not null,
  pass boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists axis_decoder_tests_upload_id_idx
  on public.axis_decoder_tests (upload_id);

create index if not exists axis_decoder_tests_created_at_desc_idx
  on public.axis_decoder_tests (created_at desc);

create index if not exists axis_decoder_tests_pass_idx
  on public.axis_decoder_tests (pass);
