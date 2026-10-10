-- ============================================================
-- Face Signature — Supabase schema
-- Paste this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Services table (the catalog)
create table if not exists services (
  id text primary key,
  category text not null,
  name text not null,
  price integer not null,
  old_price integer,
  duration integer not null, -- minutes
  note text,
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Bookings table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id text references services(id),
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  appointment_at timestamptz not null,
  duration integer not null,
  total integer not null,
  notes text,
  status text default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  is_new boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_bookings_date on bookings(appointment_at);
create index if not exists idx_bookings_status on bookings(status);

-- Row Level Security
alter table services enable row level security;
alter table bookings enable row level security;

-- Anyone can read services
drop policy if exists "services_read_all" on services;
create policy "services_read_all" on services for select using (true);

-- Anyone can create a booking (public booking)
drop policy if exists "bookings_insert_public" on bookings;
create policy "bookings_insert_public" on bookings for insert with check (true);

-- Only authenticated users (admin) can read/update/delete bookings
drop policy if exists "bookings_read_auth" on bookings;
create policy "bookings_read_auth" on bookings for select using (auth.role() = 'authenticated');

drop policy if exists "bookings_update_auth" on bookings;
create policy "bookings_update_auth" on bookings for update using (auth.role() = 'authenticated');

drop policy if exists "bookings_delete_auth" on bookings;
create policy "bookings_delete_auth" on bookings for delete using (auth.role() = 'authenticated');

-- ============================================================
-- Seed services with real prices from your menu
-- ============================================================
insert into services (id, category, name, price, old_price, duration, note, sort_order) values
  -- Sourcils
  ('mb1','Sourcils','Microshading',99,180,90,null,1),
  ('mb2','Sourcils','Microblading',120,220,120,null,2),
  ('mb3','Sourcils','Powder Brow',120,220,120,null,3),
  ('mb4','Sourcils','Brow Lift',50,null,45,null,4),
  ('mb5','Sourcils','Détatouage sourcils',50,null,60,'à partir de 50€',5),
  ('mb6','Sourcils','Reprise (correction)',140,null,90,null,6),
  ('mb7','Sourcils','Retouche sourcils 1 mois',70,null,60,null,7),
  ('mb8','Sourcils','Retouche sourcils 3 mois',80,null,60,null,8),
  ('mb9','Sourcils','Retouche sourcils 6 mois',90,null,60,null,9),
  ('mb10','Sourcils','Retouche sourcils 1 an',100,null,60,null,10),
  ('mb11','Sourcils','Anesthésie',10,null,15,null,11),
  -- Candelips & Eyeliner
  ('cl1','Candelips & Eyeliner','Candelips',160,250,120,null,12),
  ('cl2','Candelips & Eyeliner','Retouche Candelips 1 mois',80,120,60,null,13),
  ('cl3','Candelips & Eyeliner','Eyeliner',150,230,90,null,14),
  ('cl4','Candelips & Eyeliner','Retouche Eyeliner',70,null,60,null,15),
  -- Cils & Dents
  ('cd1','Cils & Dents','Extension de cils',50,null,90,'à partir de 50€',16),
  ('cd3','Cils & Dents','Effets volume russe',70,null,75,null,17),
  ('cd2','Cils & Dents','Blanchiment dents',70,150,45,null,18)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  price = excluded.price,
  old_price = excluded.old_price,
  duration = excluded.duration,
  note = excluded.note,
  sort_order = excluded.sort_order;

-- Scheduling capacity, multiple treatments and blocked periods
-- Run once in the existing project's Supabase SQL Editor BEFORE deploying this change.
-- This migration preserves existing bookings and works when re-run.
begin;

alter table public.bookings add column if not exists service_items jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists treatment_mode text not null default 'sequential';
alter table public.bookings drop constraint if exists bookings_treatment_mode_check;
alter table public.bookings add constraint bookings_treatment_mode_check check (treatment_mode in ('simultaneous', 'sequential'));
alter table public.bookings drop constraint if exists bookings_service_items_check;
alter table public.bookings add constraint bookings_service_items_check check (jsonb_typeof(service_items) = 'array');
alter table public.bookings drop constraint if exists bookings_duration_check;
alter table public.bookings add constraint bookings_duration_check check (duration > 0 and duration <= 1440) not valid;

create table if not exists public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default 'Indisponible',
  created_at timestamptz not null default now(),
  constraint blocked_periods_valid_range check (ends_at > starts_at)
);
create index if not exists idx_blocked_periods_range on public.blocked_periods(starts_at, ends_at);
alter table public.blocked_periods enable row level security;
drop policy if exists blocked_periods_admin on public.blocked_periods;
create policy blocked_periods_admin on public.blocked_periods for all
  to authenticated using (true) with check (true);
grant select, insert, update, delete on public.blocked_periods to authenticated, service_role;

-- Public creation goes through the server API, which validates catalog prices and duration.
drop policy if exists bookings_insert_public on public.bookings;

-- Every scheduling mutation shares one transaction lock, acquired BEFORE any row locks.
-- VOLATILE checks below read a fresh snapshot after a concurrent writer commits.
create or replace function public.lock_face_schedule() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(2147483000, 42);
  return null;
end;
$$;
drop trigger if exists bookings_schedule_lock on public.bookings;
create trigger bookings_schedule_lock before insert or update or delete on public.bookings
  for each statement execute function public.lock_face_schedule();
drop trigger if exists blocked_periods_schedule_lock on public.blocked_periods;
create trigger blocked_periods_schedule_lock before insert or update or delete on public.blocked_periods
  for each statement execute function public.lock_face_schedule();

create or replace function public.check_booking_schedule() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare
  finish timestamptz;
  occupied integer;
begin
  if new.status = 'cancelled' then return new; end if;
  -- Editing contact details or marking an old RDV complete need not revalidate its slot.
  if tg_op = 'UPDATE' then
    if old.status <> 'cancelled'
      and new.appointment_at = old.appointment_at and new.duration = old.duration then
      return new;
    end if;
  end if;
  finish := new.appointment_at + new.duration * interval '1 minute';
  if exists (
    select 1 from public.blocked_periods p
    where p.starts_at < finish and p.ends_at > new.appointment_at
  ) then
    raise exception using errcode = '23P01', message = 'FS_BLOCKED';
  end if;
  with overlapping as (
    select greatest(b.appointment_at, new.appointment_at) as starts,
      least(b.appointment_at + b.duration * interval '1 minute', finish) as ends
    from public.bookings b
    where b.id <> new.id and b.status <> 'cancelled'
      and b.appointment_at < finish
      and b.appointment_at + b.duration * interval '1 minute' > new.appointment_at
  ), events as (
    select starts as moment, 1 as delta from overlapping
    union all select ends as moment, -1 as delta from overlapping
  ), grouped as (
    select moment, sum(delta) as delta from events group by moment
  ), counts as (
    select sum(delta) over (order by moment) as concurrent from grouped
  ) select coalesce(max(concurrent), 0) into occupied from counts;
  if occupied >= 2 then
    raise exception using errcode = '23P01', message = 'FS_CAPACITY';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_schedule_check on public.bookings;
create trigger bookings_schedule_check before insert or update on public.bookings
  for each row execute function public.check_booking_schedule();

create or replace function public.check_blocked_period() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.bookings b where b.status <> 'cancelled'
      and b.appointment_at < new.ends_at
      and b.appointment_at + b.duration * interval '1 minute' > new.starts_at
  ) then
    raise exception using errcode = '23P01', message = 'FS_BLOCK_HAS_BOOKINGS';
  end if;
  return new;
end;
$$;
drop trigger if exists blocked_periods_schedule_check on public.blocked_periods;
create trigger blocked_periods_schedule_check before insert or update on public.blocked_periods
  for each row execute function public.check_blocked_period();

-- Public availability must not expose names, contact details, booking IDs or closure labels.
create or replace function public.get_booking_availability(p_from timestamptz, p_until timestamptz)
returns table (start_at timestamptz, end_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is null or p_until is null or p_until <= p_from or p_until > p_from + interval '31 days' then
    raise exception 'Invalid availability range';
  end if;
  return query
    select b.appointment_at, b.appointment_at + b.duration * interval '1 minute', 'booking'::text
    from public.bookings b
    where b.status <> 'cancelled' and b.appointment_at < p_until
      and b.appointment_at + b.duration * interval '1 minute' > p_from
    union all
    select p.starts_at, p.ends_at, 'blocked'::text from public.blocked_periods p
    where p.starts_at < p_until and p.ends_at > p_from;
end;
$$;
revoke all on function public.lock_face_schedule() from public, anon, authenticated;
revoke all on function public.check_booking_schedule() from public, anon, authenticated;
revoke all on function public.check_blocked_period() from public, anon, authenticated;
revoke all on function public.get_booking_availability(timestamptz, timestamptz) from public;
grant execute on function public.get_booking_availability(timestamptz, timestamptz) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
