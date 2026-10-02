-- Call Center live user data for Supabase project glonbvrcudwuzjundrii
-- Run once in the Supabase SQL editor.

create table if not exists public.callcenter_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  phone text not null default '',
  referral_code text not null unique,
  referred_by_user_id uuid references auth.users(id) on delete set null,
  onboarding_completed boolean not null default false,
  commission_acknowledged boolean not null default false,
  referrals_acknowledged boolean not null default false,
  last_call_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.callcenter_referral_codes (
  code text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.callcenter_call_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  crm_id uuid references public.crm(id) on delete set null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  outcome text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.callcenter_commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crm_id uuid references public.crm(id) on delete set null,
  client_name text not null default '',
  sale_amount_cents bigint,
  commission_amount_cents bigint,
  status text not null default 'waiting_client_payment'
    check (status in ('waiting_client_payment','pending','complete')),
  source text not null default 'crm',
  source_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  pending_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (crm_id, user_id)
);

create table if not exists public.callcenter_referral_bonuses (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  commission_id uuid not null unique references public.callcenter_commissions(id) on delete cascade,
  amount_cents integer not null check (amount_cents in (1000,5000)),
  status text not null default 'pending' check (status in ('pending','complete')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.callcenter_profiles enable row level security;
alter table public.callcenter_referral_codes enable row level security;
alter table public.callcenter_call_activity enable row level security;
alter table public.callcenter_commissions enable row level security;
alter table public.callcenter_referral_bonuses enable row level security;

drop policy if exists "callcenter profiles read own" on public.callcenter_profiles;
create policy "callcenter profiles read own" on public.callcenter_profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "callcenter profiles read referred users" on public.callcenter_profiles;
create policy "callcenter profiles read referred users" on public.callcenter_profiles
for select to authenticated
using ((select auth.uid()) = referred_by_user_id);

drop policy if exists "callcenter profiles update own" on public.callcenter_profiles;
create policy "callcenter profiles update own" on public.callcenter_profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "referral codes lookup" on public.callcenter_referral_codes;
create policy "referral codes lookup" on public.callcenter_referral_codes
for select to authenticated using (true);

drop policy if exists "call activity read own" on public.callcenter_call_activity;
create policy "call activity read own" on public.callcenter_call_activity
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "call activity insert own" on public.callcenter_call_activity;
create policy "call activity insert own" on public.callcenter_call_activity
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "commissions read own" on public.callcenter_commissions;
create policy "commissions read own" on public.callcenter_commissions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "referral bonuses read own" on public.callcenter_referral_bonuses;
create policy "referral bonuses read own" on public.callcenter_referral_bonuses
for select to authenticated
using ((select auth.uid()) = referrer_user_id);

grant select on public.callcenter_profiles, public.callcenter_referral_codes,
  public.callcenter_call_activity, public.callcenter_commissions, public.callcenter_referral_bonuses
to authenticated;
grant insert on public.callcenter_call_activity to authenticated;
grant update (display_name, phone, referred_by_user_id, onboarding_completed,
  commission_acknowledged, referrals_acknowledged, updated_at)
on public.callcenter_profiles to authenticated;

create schema if not exists private;

create or replace function private.callcenter_make_referral_code(p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$ select upper(substr(md5(p_user_id::text), 1, 8)); $$;

create or replace function private.callcenter_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_name text;
begin
  v_code := private.callcenter_make_referral_code(new.id);
  v_name := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', '');

  insert into public.callcenter_profiles(user_id,email,display_name,referral_code)
  values(new.id,coalesce(new.email,''),v_name,v_code)
  on conflict (user_id) do nothing;

  insert into public.callcenter_referral_codes(code,user_id)
  values(v_code,new.id)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists callcenter_profile_on_auth_user on auth.users;
create trigger callcenter_profile_on_auth_user
after insert on auth.users
for each row execute function private.callcenter_create_profile();

insert into public.callcenter_profiles(user_id,email,display_name,referral_code)
select
  u.id,
  coalesce(u.email,''),
  coalesce(u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name',''),
  private.callcenter_make_referral_code(u.id)
from auth.users u
on conflict (user_id) do nothing;

insert into public.callcenter_referral_codes(code,user_id)
select p.referral_code,p.user_id
from public.callcenter_profiles p
on conflict do nothing;

create or replace function private.callcenter_touch_last_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.callcenter_profiles
  set last_call_at = greatest(coalesce(last_call_at,'epoch'::timestamptz), new.created_at),
      updated_at = now()
  where user_id = new.user_id;
  return new;
end $$;

drop trigger if exists callcenter_activity_touch_profile on public.callcenter_call_activity;
create trigger callcenter_activity_touch_profile
after insert on public.callcenter_call_activity
for each row execute function private.callcenter_touch_last_call();

create or replace function private.callcenter_resolve_sales_user(p_crm public.crm)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_crm.soldby is not null and btrim(p_crm.soldby) <> '' then
    select id into v_user
    from auth.users
    where lower(email)=lower(btrim(p_crm.soldby))
    limit 1;

    if v_user is null then
      select user_id into v_user
      from public.callcenter_profiles
      where lower(display_name)=lower(btrim(p_crm.soldby))
      limit 1;
    end if;
  end if;

  if v_user is null
     and p_crm.userid is not null
     and exists (
       select 1
       from public.team_permissions tp
       where tp.user_id=p_crm.userid and tp.role='SALES'
     ) then
    v_user := p_crm.userid;
  end if;

  return v_user;
end $$;

create or replace function private.callcenter_sync_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_payment public.payments;
  v_status text := 'waiting_client_payment';
begin
  if not (new.relationship='client' or new.stage='complete') then
    return new;
  end if;

  v_user := private.callcenter_resolve_sales_user(new);
  if v_user is null then return new; end if;

  select p.* into v_payment
  from public.payments p
  where p.crmid=new.id
    and lower(coalesce(p.status,'')) in ('paid','completed','complete','approved','success')
  order by coalesce(p.paid,p.created) desc
  limit 1;

  if v_payment.id is not null then v_status := 'pending'; end if;

  insert into public.callcenter_commissions(
    user_id,crm_id,client_name,sale_amount_cents,status,source_payment_id,pending_at
  ) values (
    v_user,new.id,coalesce(nullif(new.company,''),nullif(new.name,''),'Client'),
    case when v_payment.id is not null then v_payment.amount else null end,
    v_status,v_payment.id,
    case when v_status='pending' then now() else null end
  )
  on conflict (crm_id,user_id) do update set
    client_name=excluded.client_name,
    sale_amount_cents=coalesce(excluded.sale_amount_cents,public.callcenter_commissions.sale_amount_cents),
    source_payment_id=coalesce(excluded.source_payment_id,public.callcenter_commissions.source_payment_id),
    status=case
      when public.callcenter_commissions.status='complete' then 'complete'
      when excluded.status='pending' then 'pending'
      else public.callcenter_commissions.status
    end,
    pending_at=coalesce(public.callcenter_commissions.pending_at,excluded.pending_at),
    updated_at=now();

  return new;
end $$;

drop trigger if exists callcenter_sync_sale_from_crm on public.crm;
create trigger callcenter_sync_sale_from_crm
after insert or update of relationship,stage,soldby,userid,company,name
on public.crm
for each row execute function private.callcenter_sync_sale();

create or replace function private.callcenter_payment_to_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.status,'')) in ('paid','completed','complete','approved','success') then
    update public.callcenter_commissions
    set status=case when status='complete' then 'complete' else 'pending' end,
        sale_amount_cents=coalesce(new.amount,sale_amount_cents),
        source_payment_id=new.id,
        pending_at=coalesce(pending_at,coalesce(new.paid,now())),
        updated_at=now()
    where crm_id=new.crmid;
  end if;
  return new;
end $$;

drop trigger if exists callcenter_payment_to_pending on public.payments;
create trigger callcenter_payment_to_pending
after insert or update of status,amount,paid on public.payments
for each row execute function private.callcenter_payment_to_pending();

create or replace function private.callcenter_create_referral_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
  v_prior_count integer;
  v_amount integer;
begin
  if new.status <> 'complete'
     or (tg_op='UPDATE' and old.status='complete') then
    return new;
  end if;

  select referred_by_user_id into v_referrer
  from public.callcenter_profiles
  where user_id=new.user_id;

  if v_referrer is null then return new; end if;

  select count(*) into v_prior_count
  from public.callcenter_commissions
  where user_id=new.user_id
    and status='complete'
    and id<>new.id;

  v_amount := case when v_prior_count=0 then 5000 else 1000 end;

  insert into public.callcenter_referral_bonuses(
    referrer_user_id,referred_user_id,commission_id,amount_cents,status
  )
  values(v_referrer,new.user_id,new.id,v_amount,'pending')
  on conflict (commission_id) do nothing;

  return new;
end $$;

drop trigger if exists callcenter_referral_bonus_on_commission on public.callcenter_commissions;
create trigger callcenter_referral_bonus_on_commission
after insert or update of status on public.callcenter_commissions
for each row execute function private.callcenter_create_referral_bonus();


create or replace function private.callcenter_sync_sale_row(p_crm public.crm)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  v_user uuid;
  v_payment public.payments;
  v_status text := 'waiting_client_payment';
begin
  v_user := private.callcenter_resolve_sales_user(p_crm);
  if v_user is null then return; end if;

  select p.* into v_payment
  from public.payments p
  where p.crmid=p_crm.id
    and lower(coalesce(p.status,'')) in ('paid','completed','complete','approved','success')
  order by coalesce(p.paid,p.created) desc
  limit 1;

  if v_payment.id is not null then v_status := 'pending'; end if;

  insert into public.callcenter_commissions(
    user_id,crm_id,client_name,sale_amount_cents,status,source_payment_id,pending_at
  ) values (
    v_user,p_crm.id,coalesce(nullif(p_crm.company,''),nullif(p_crm.name,''),'Client'),
    case when v_payment.id is not null then v_payment.amount else null end,
    v_status,v_payment.id,
    case when v_status='pending' then now() else null end
  )
  on conflict (crm_id,user_id) do update set
    client_name=excluded.client_name,
    sale_amount_cents=coalesce(excluded.sale_amount_cents,public.callcenter_commissions.sale_amount_cents),
    source_payment_id=coalesce(excluded.source_payment_id,public.callcenter_commissions.source_payment_id),
    status=case
      when public.callcenter_commissions.status='complete' then 'complete'
      when excluded.status='pending' then 'pending'
      else public.callcenter_commissions.status
    end,
    pending_at=coalesce(public.callcenter_commissions.pending_at,excluded.pending_at),
    updated_at=now();
end $;

-- Existing client/sold rows are seeded into Waiting/Pending without inventing a commission rate.
do $$
declare
  r public.crm;
begin
  for r in
    select *
    from public.crm
    where relationship='client' or stage='complete'
  loop
    perform private.callcenter_sync_sale_row(r);
  end loop;
end $$;
