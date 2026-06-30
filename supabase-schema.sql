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
  google_event_id text,
  google_event_link text,
  calendar_sync_status text default 'pending',
  calendar_sync_error text,
  created_at timestamptz default now()
);

-- Safe migration for existing projects
alter table if exists bookings add column if not exists google_event_id text;
alter table if exists bookings add column if not exists google_event_link text;
alter table if exists bookings add column if not exists calendar_sync_status text default 'pending';
alter table if exists bookings add column if not exists calendar_sync_error text;

do $$
begin
  alter table bookings
    add constraint bookings_calendar_sync_status_check
    check (calendar_sync_status in ('pending','synced','error','skipped'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_bookings_date on bookings(appointment_at);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_google_event_id on bookings(google_event_id);
create index if not exists idx_bookings_calendar_sync_status on bookings(calendar_sync_status);

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
  ('mb1','Sourcils','Microshading',90,180,90,null,1),
  ('mb2','Sourcils','Microblading',120,220,120,null,2),
  ('mb3','Sourcils','Powder Brow',120,220,120,null,3),
  ('mb4','Sourcils','Mixte (Microblading + Shading)',120,220,120,null,4),
  ('mb5','Sourcils','Détatouage sourcils',80,null,60,'à partir de 80€',5),
  ('mb6','Sourcils','Reprise (correction)',120,null,90,null,6),
  ('mb7','Sourcils','Retouche 1 mois',70,null,60,'anesthésie +10€',7),
  ('mb8','Sourcils','Retouche 3 mois',80,null,60,'anesthésie +10€',8),
  ('mb9','Sourcils','Retouche 6 mois',90,null,60,'anesthésie +10€',9),
  ('mb10','Sourcils','Retouche 1 an',100,null,60,'anesthésie +10€',10),
  -- Candelips & Eyeliner
  ('cl1','Candelips & Eyeliner','Candelips',160,250,120,null,11),
  ('cl2','Candelips & Eyeliner','Retouche Candelips (1 mois)',80,120,60,null,12),
  ('cl3','Candelips & Eyeliner','Eyeliner',150,230,90,null,13),
  ('cl4','Candelips & Eyeliner','Retouche Eyeliner',70,null,60,null,14),
  -- Cils & Dents
  ('cd1','Cils & Dents','Extension de cils',50,null,90,'à partir de 50€',15),
  ('cd2','Cils & Dents','Blanchiment dents',70,150,45,null,16),
  ('cd3','Cils & Dents','Effets volume',70,null,75,null,17)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  price = excluded.price,
  old_price = excluded.old_price,
  duration = excluded.duration,
  note = excluded.note,
  sort_order = excluded.sort_order;
