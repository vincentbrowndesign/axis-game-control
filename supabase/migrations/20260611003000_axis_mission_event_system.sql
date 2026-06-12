alter table public.axis_mission_events
  drop constraint if exists axis_mission_events_type_check;

update public.axis_mission_events
  set type = case type
    when 'COUNT_RECORDED' then 'PROGRESS_UPDATE'
    when 'RESULT_RECORDED' then 'PROGRESS_UPDATE'
    when 'MISSION_PAUSED' then 'BREAK'
    when 'MISSION_RESUMED' then 'PROGRESS_UPDATE'
    when 'SESSION_ENDED' then 'FINISHED'
    when 'SESSION_EVALUATED' then 'FINISHED'
    when 'COMMAND' then 'COACH_NOTE'
    else type
  end;

alter table public.axis_mission_events
  add constraint axis_mission_events_type_check
  check (type in (
    'SESSION_STARTED',
    'PROGRESS_UPDATE',
    'COACH_NOTE',
    'BREAK',
    'CORRECTION',
    'FINISHED'
  ));
