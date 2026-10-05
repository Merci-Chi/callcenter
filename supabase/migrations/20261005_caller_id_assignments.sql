create table if not exists public.callcenter_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  label text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callcenter_phone_numbers_e164 check (phone_number ~ '^\+[1-9][0-9]{7,14}$')
);

create table if not exists public.callcenter_phone_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number_id uuid not null references public.callcenter_phone_numbers(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (phone_number_id)
);

alter table public.callcenter_phone_numbers enable row level security;
alter table public.callcenter_phone_assignments enable row level security;

drop policy if exists "Admins manage caller id numbers" on public.callcenter_phone_numbers;
create policy "Admins manage caller id numbers"
on public.callcenter_phone_numbers
for all
to authenticated
using (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = auth.uid()
      and tp.active = true
      and tp.role = 'ADMIN'
  )
)
with check (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = auth.uid()
      and tp.active = true
      and tp.role = 'ADMIN'
  )
);

drop policy if exists "Admins manage caller id assignments" on public.callcenter_phone_assignments;
create policy "Admins manage caller id assignments"
on public.callcenter_phone_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = auth.uid()
      and tp.active = true
      and tp.role = 'ADMIN'
  )
)
with check (
  exists (
    select 1
    from public.team_permissions tp
    where tp.user_id = auth.uid()
      and tp.active = true
      and tp.role = 'ADMIN'
  )
);

create index if not exists callcenter_phone_assignments_user_idx
  on public.callcenter_phone_assignments(user_id);

create index if not exists callcenter_phone_assignments_phone_idx
  on public.callcenter_phone_assignments(phone_number_id);
