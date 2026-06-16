-- Canonical understanding: the authoritative current belief state per thread.
-- Axis must be able to continue from this object directly, without
-- reconstructing it from event history.
alter table axis_threads
  add column if not exists current_understanding jsonb;
