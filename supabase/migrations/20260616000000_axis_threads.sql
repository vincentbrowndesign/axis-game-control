-- Axis thread system — clean schema for continuity architecture.
-- Replaces axis_dev_threads memory JSONB with explicit relational tables.
-- No RLS during development (middleware is in diagnostic bypass).

create table if not exists axis_threads (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users(id) on delete set null,
  title              text,
  goal               text,
  focus              text,
  current_bottleneck text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Beliefs = hypotheses the model establishes per thread.
-- belief_id is the semantic slug from the model (e.g. "set-point-drift").
create table if not exists axis_thread_beliefs (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references axis_threads(id) on delete cascade,
  belief_id   text,
  statement   text        not null,
  status      text        not null default 'active'
              check (status in ('active', 'confirmed', 'rejected')),
  confidence  numeric     not null default 0.7
              check (confidence >= 0 and confidence <= 1),
  created_at  timestamptz not null default now()
);

-- All user + assistant turns stored as events (JSONB content).
create table if not exists axis_thread_events (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references axis_threads(id) on delete cascade,
  role        text        not null check (role in ('user', 'assistant')),
  content     jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Evidence submitted by user (text, photo, video).
create table if not exists axis_thread_evidence (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references axis_threads(id) on delete cascade,
  observation text        not null,
  claim       text,
  source      text        not null default 'user_report',
  confidence  numeric     not null default 0.7
              check (confidence >= 0 and confidence <= 1),
  created_at  timestamptz not null default now()
);

-- Experiments the model proposes; status updated when user reports result.
create table if not exists axis_thread_experiments (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references axis_threads(id) on delete cascade,
  hypothesis  text        not null,
  status      text        not null default 'open'
              check (status in ('open', 'completed', 'failed', 'inconclusive')),
  result      text,
  verdict     text        check (verdict in ('PASS', 'FAIL', 'INCONCLUSIVE')),
  created_at  timestamptz not null default now()
);

-- Confirmed breakthroughs (durable changes in understanding).
create table if not exists axis_thread_breakthroughs (
  id          uuid        primary key default gen_random_uuid(),
  thread_id   uuid        not null references axis_threads(id) on delete cascade,
  description text        not null,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists idx_atb_thread  on axis_thread_beliefs(thread_id);
create index if not exists idx_ate_thread  on axis_thread_events(thread_id, created_at);
create index if not exists idx_ate_created on axis_thread_events(thread_id, created_at desc);
create index if not exists idx_athr_thread on axis_threads(user_id, updated_at desc);
