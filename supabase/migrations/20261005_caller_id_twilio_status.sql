alter table public.callcenter_phone_numbers
  add column if not exists twilio_status text not null default 'pending'
  check (twilio_status in ('pending','ready'));

update public.callcenter_phone_numbers
set twilio_status = 'pending'
where twilio_status is null;
