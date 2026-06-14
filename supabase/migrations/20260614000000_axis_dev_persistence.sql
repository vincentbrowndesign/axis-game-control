-- axis_dev_threads: a coaching conversation
-- title is derived from the first intent (set by the server on first entry)
create table if not exists axis_dev_threads (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade not null,
  title       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table axis_dev_threads enable row level security;

create policy "axis_dev_threads_user_policy"
  on axis_dev_threads for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index axis_dev_threads_user_created
  on axis_dev_threads(user_id, created_at desc);

-- axis_dev_entries: individual coaching moments within a thread
-- stores only the meaningful coaching output, not generated report scaffolding
create table if not exists axis_dev_entries (
  id              uuid        primary key default gen_random_uuid(),
  thread_id       uuid        references axis_dev_threads(id) on delete cascade not null,
  user_id         uuid        references auth.users(id) not null,
  intent          text        not null,
  insight         text,
  reasoning       text,
  mental_model    text,
  demonstration   jsonb,      -- {currentState, targetState, keyDifference, executionCue}
  experiment      text,       -- the actionable instruction (hypothesis)
  confidence      numeric,
  position        integer     not null default 0,
  created_at      timestamptz default now()
);

alter table axis_dev_entries enable row level security;

create policy "axis_dev_entries_user_policy"
  on axis_dev_entries for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index axis_dev_entries_thread
  on axis_dev_entries(thread_id, position);

-- axis_breakthroughs: first-class entities, not derived cards
-- a breakthrough is a durable change in understanding, execution, or behavior
create table if not exists axis_breakthroughs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade not null,
  thread_id   uuid        references axis_dev_threads(id) on delete set null,
  entry_id    uuid        references axis_dev_entries(id) on delete set null,
  description text        not null,
  domain      text,
  created_at  timestamptz default now()
);

alter table axis_breakthroughs enable row level security;

create policy "axis_breakthroughs_user_policy"
  on axis_breakthroughs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index axis_breakthroughs_user
  on axis_breakthroughs(user_id, created_at desc);

-- axis_dev_evidence: observations → claims → questions → development opportunities
-- every item must have an observation; the rest are derived and ranked by confidence
create table if not exists axis_dev_evidence (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        references auth.users(id) on delete cascade not null,
  thread_id                uuid        references axis_dev_threads(id) on delete set null,
  entry_id                 uuid        references axis_dev_entries(id) on delete set null,
  observation              text        not null,
  claim                    text,
  question                 text,
  development_opportunity  text,
  confidence               numeric     default 0.5,
  source                   text        default 'user_report',
  created_at               timestamptz default now()
);

alter table axis_dev_evidence enable row level security;

create policy "axis_dev_evidence_user_policy"
  on axis_dev_evidence for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index axis_dev_evidence_user
  on axis_dev_evidence(user_id, created_at desc);

create index axis_dev_evidence_thread
  on axis_dev_evidence(thread_id);

-- grant to authenticated and anon roles (for guest / anonymous sessions)
grant select, insert, update, delete
  on axis_dev_threads, axis_dev_entries, axis_breakthroughs, axis_dev_evidence
  to authenticated, anon;
