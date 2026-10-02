-- SAFE ACTIVITY PERMISSIONS ONLY
-- Run this by itself in Supabase SQL Editor.
-- Do NOT rerun the full supabase-callcenter.sql migration for this change.

set lock_timeout = '5s';
set statement_timeout = '30s';

drop policy if exists "callcenter profiles admin read all"
on public.callcenter_profiles;

create policy "callcenter profiles admin read all"
on public.callcenter_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = (select auth.uid())
      and tp.role in ('ADMIN','MOD')
      and tp.active = true
  )
);

drop policy if exists "call activity admin read all"
on public.callcenter_call_activity;

create policy "call activity admin read all"
on public.callcenter_call_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = (select auth.uid())
      and tp.role in ('ADMIN','MOD')
      and tp.active = true
  )
);
