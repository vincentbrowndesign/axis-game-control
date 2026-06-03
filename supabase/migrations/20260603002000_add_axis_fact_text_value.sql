alter table public.axis_artifact_facts
  add column if not exists fact_text_value text;

create index if not exists axis_artifact_facts_text_value_idx
  on public.axis_artifact_facts (fact_key, fact_text_value);
