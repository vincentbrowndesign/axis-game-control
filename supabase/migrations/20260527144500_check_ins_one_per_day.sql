create unique index if not exists check_ins_one_per_user_org_day_idx
  on public.check_ins (
    user_id,
    organization_slug,
    ((checked_in_at at time zone 'America/Chicago')::date)
  );
