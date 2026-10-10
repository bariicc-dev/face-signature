import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;
const migration = readFileSync('supabase/migrations/20261010_scheduling.sql', 'utf8');
const base = readFileSync('supabase-schema.sql', 'utf8').split('-- Scheduling capacity, multiple treatments and blocked periods')[0];

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.role() returns text language sql as $$ select coalesce(current_setting('request.jwt.claim.role', true), 'anon') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  await db.exec(base);
  // Supabase grants table privileges by default; RLS remains responsible for row access.
  await db.exec('grant all on all tables in schema public to anon, authenticated, service_role;');
  await db.exec(migration);
}, { timeout: 30000 });
beforeEach(async () => { await db.exec('reset role; delete from public.bookings; delete from public.blocked_periods;'); });
after(async () => { await db.close(); });

async function add(at = '2026-10-12T10:00:00Z', duration = 60, status = 'confirmed') {
  const result = await db.query<{ id: string }>(`insert into public.bookings (service_id, client_name, client_email, client_phone, appointment_at, duration, total, status)
    values ('mb1', 'Test cliente', 'test@example.com', '0612345678', $1, $2, 99, $3) returning id`, [at, duration, status]);
  return result.rows[0].id;
}
async function block(from = '2026-10-12T09:00:00Z', until = '2026-10-12T11:00:00Z') {
  const result = await db.query<{ id: string }>('insert into public.blocked_periods (starts_at, ends_at, label) values ($1, $2, $3) returning id', [from, until, 'Motif privé']);
  return result.rows[0].id;
}

test('database accepts two clients and rejects a third', async () => {
  await add(); await add();
  await assert.rejects(add(), /FS_CAPACITY/);
  assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.bookings')).rows[0].count, 2);
});

test('checks staggered overlaps across the entire appointment', async () => {
  await add('2026-10-12T10:45:00Z', 30);
  await add('2026-10-12T11:00:00Z', 30);
  await assert.rejects(add('2026-10-12T10:00:00Z', 120), /FS_CAPACITY/);
});

test('successive clients and touching endpoints leave one place for a long appointment', async () => {
  await add('2026-10-12T10:00:00Z', 60);
  await add('2026-10-12T11:00:00Z', 60);
  await add('2026-10-12T10:00:00Z', 120);
  await add('2026-10-12T12:00:00Z', 60);
});

test('cancellation frees capacity, restoration and rescheduling recheck it', async () => {
  const id = await add(); await add();
  await db.query("update public.bookings set status = 'cancelled' where id = $1", [id]);
  await add();
  await assert.rejects(db.query("update public.bookings set status = 'confirmed' where id = $1", [id]), /FS_CAPACITY/);
  const later = await add('2026-10-12T13:00:00Z');
  await assert.rejects(db.query("update public.bookings set appointment_at = '2026-10-12T10:00:00Z' where id = $1", [later]), /FS_CAPACITY/);
  await db.query('update public.bookings set notes = $1 where id = $2', ['New note', later]);
});

test('blocked periods reject public/manual inserts, moves and restored bookings', async () => {
  const later = await add('2026-10-12T13:00:00Z');
  const cancelled = await add('2026-10-12T10:00:00Z', 60, 'cancelled');
  const id = await block();
  await assert.rejects(add(), /FS_BLOCKED/);
  await assert.rejects(db.query("update public.bookings set appointment_at = '2026-10-12T10:00:00Z' where id = $1", [later]), /FS_BLOCKED/);
  await assert.rejects(db.query("update public.bookings set status = 'confirmed' where id = $1", [cancelled]), /FS_BLOCKED/);
  await db.query('delete from public.blocked_periods where id = $1', [id]);
  await add();
});

test('closures reject existing appointments and find visits beginning the previous day', async () => {
  await add('2026-10-11T23:30:00Z', 90);
  await assert.rejects(block('2026-10-12T00:00:00Z', '2026-10-12T02:00:00Z'), /FS_BLOCK_HAS_BOOKINGS/);
  assert.equal((await db.query('select * from public.blocked_periods')).rows.length, 0);
});

test('multi-day holidays close both places until the exclusive end', async () => {
  await block('2026-10-12T00:00:00Z', '2026-10-16T00:00:00Z');
  await assert.rejects(add('2026-10-15T23:30:00Z', 60), /FS_BLOCKED/);
  await assert.rejects(add('2026-10-11T23:30:00Z', 60), /FS_BLOCKED/);
  await add('2026-10-16T00:00:00Z');
});

test('public availability exposes ranges only and does not allow anonymous booking inserts', async () => {
  await add(); await block('2026-10-12T12:00:00Z', '2026-10-12T14:00:00Z');
  await db.exec('set role anon;');
  const availability = await db.query("select * from public.get_booking_availability('2026-10-12T00:00:00Z', '2026-10-13T00:00:00Z')");
  assert.equal(availability.rows.length, 2);
  for (const row of availability.rows) assert.deepEqual(Object.keys(row).sort(), ['end_at', 'kind', 'start_at']);
  assert.equal((await db.query('select * from public.bookings')).rows.length, 0);
  await assert.rejects(add(), /row-level security/);
  await db.exec('reset role;');
});

test('migration is repeatable and preserves legacy bookings and recorded durations', async () => {
  const id = await add('2026-10-12T13:00:00Z', 75);
  await db.exec(migration);
  const row = (await db.query<{ duration: number; service_items: unknown[]; treatment_mode: string }>('select duration, service_items, treatment_mode from public.bookings where id = $1', [id])).rows[0];
  assert.equal(row.duration, 75);
  assert.deepEqual(row.service_items, []);
  assert.equal(row.treatment_mode, 'sequential');
  assert.ok(readFileSync('supabase-schema.sql', 'utf8').endsWith(migration));
});
