-- Thread memory: five development buckets per coaching thread.
-- Stored as JSONB on axis_dev_threads — no separate table needed.
-- Keeps focus, experiments, evidence, breakthroughs, and open questions
-- in one place so a single select loads the full working state.

alter table axis_dev_threads
  add column if not exists memory jsonb not null default
    '{"focus":null,"experiments":[],"evidence":[],"breakthroughs":[],"openQuestions":[]}'::jsonb;
