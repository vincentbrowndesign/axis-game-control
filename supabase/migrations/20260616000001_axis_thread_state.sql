-- Add open_questions and next_action to axis_threads.
-- open_questions is a native array so appends/removals stay in one column.
-- next_action is the model's instruction for the next session.

alter table axis_threads
  add column if not exists open_questions text[] not null default array[]::text[],
  add column if not exists next_action text;
