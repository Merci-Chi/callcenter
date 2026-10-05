alter table public.callcenter_profiles
  add column if not exists theme_preference text not null default 'light';

alter table public.callcenter_profiles
  drop constraint if exists callcenter_profiles_theme_preference_check;

alter table public.callcenter_profiles
  add constraint callcenter_profiles_theme_preference_check
  check (theme_preference in ('light','dark'));

update public.callcenter_profiles
set theme_preference = 'light'
where theme_preference is null
   or theme_preference not in ('light','dark');
