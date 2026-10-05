alter table public.callcenter_phone_numbers
  add column if not exists requested_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists requested_at timestamptz;

update public.callcenter_phone_numbers
set requested_at = coalesce(requested_at, created_at)
where requested_by_user_id is not null
  and requested_at is null;

drop policy if exists "Users can read their requested caller ids" on public.callcenter_phone_numbers;
create policy "Users can read their requested caller ids"
on public.callcenter_phone_numbers
for select
to authenticated
using (requested_by_user_id = auth.uid());

drop policy if exists "Users can request caller ids" on public.callcenter_phone_numbers;
create policy "Users can request caller ids"
on public.callcenter_phone_numbers
for insert
to authenticated
with check (
  requested_by_user_id = auth.uid()
  and twilio_status = 'pending'
  and active = true
);

create index if not exists callcenter_phone_numbers_requested_by_idx
  on public.callcenter_phone_numbers(requested_by_user_id);
