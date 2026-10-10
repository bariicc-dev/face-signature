import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentColumns, bookingServiceName, parisAppointment, parisDayRange, remainingPlaces, treatmentSummary, type AvailabilityWindow } from '../lib/scheduling';

const booking = (from: string, until: string): AvailabilityWindow => ({ start_at: `2026-10-12T${from}:00Z`, end_at: `2026-10-12T${until}:00Z`, kind: 'booking' });
const start = '2026-10-12T10:00:00Z';

test('a second client can book, but a third cannot', () => {
  assert.equal(remainingPlaces(start, 60, []), 2);
  assert.equal(remainingPlaces(start, 60, [booking('10:00', '11:00')]), 1);
  assert.equal(remainingPlaces(start, 60, [booking('10:00', '11:00'), booking('10:30', '12:00')]), 0);
});

test('a long visit can overlap successive clients, provided they never overlap each other', () => {
  assert.equal(remainingPlaces(start, 120, [booking('10:00', '11:00'), booking('11:00', '12:00')]), 1);
});

test('checks the whole appointment, including nested and cross-midnight overlaps', () => {
  assert.equal(remainingPlaces(start, 120, [booking('10:45', '11:15'), booking('11:00', '11:30')]), 0);
  assert.equal(remainingPlaces('2026-10-13T00:00:00Z', 30, [{ start_at: '2026-10-12T23:45:00Z', end_at: '2026-10-13T00:15:00Z', kind: 'booking' }]), 1);
});

test('touching endpoints do not conflict, but a partial closure closes both places', () => {
  assert.equal(remainingPlaces(start, 60, [booking('09:00', '10:00'), booking('11:00', '12:00')]), 2);
  assert.equal(remainingPlaces(start, 60, [{ ...booking('10:30', '11:00'), kind: 'blocked' }]), 0);
  assert.equal(remainingPlaces(start, 60, [{ ...booking('11:00', '12:00'), kind: 'blocked' }]), 2);
});

test('combines prices and supports simultaneous and sequential durations', () => {
  const services = [{ id: 'one', name: 'Soin A', price: 50, duration: 45 }, { id: 'two', name: 'Soin B', price: 70, duration: 90 }];
  assert.deepEqual(treatmentSummary(services, 'simultaneous'), { total: 120, duration: 90, name: 'Soin A + Soin B' });
  assert.equal(treatmentSummary(services, 'sequential').duration, 135);
  assert.equal(treatmentSummary([]).duration, 0);
  assert.equal(bookingServiceName({ service_items: services, services: { name: 'Old first service' } }), 'Soin A + Soin B');
  assert.equal(bookingServiceName({ services: { name: 'Legacy treatment' } }), 'Legacy treatment');
});

test('Paris wall-clock times remain correct in summer, winter and DST changes', () => {
  assert.equal(parisAppointment('2026-07-12', '10:00'), '2026-07-12T08:00:00.000Z');
  assert.equal(parisAppointment('2026-12-12', '10:00'), '2026-12-12T09:00:00.000Z');
  const spring = parisDayRange('2026-03-29');
  const autumn = parisDayRange('2026-10-25');
  assert.equal((Date.parse(spring.until) - Date.parse(spring.from)) / 3600000, 23);
  assert.equal((Date.parse(autumn.until) - Date.parse(autumn.from)) / 3600000, 25);
  assert.throws(() => parisAppointment('2026-03-29', '02:30'));
  assert.throws(() => parisAppointment('2026-02-30', '10:00'));
  assert.throws(() => parisAppointment('not-a-date', '10:00'));
});

test('agenda places staggered overlapping appointments beside each other', () => {
  const appointments = [
    { id: 'a', appointment_at: start, duration: 60 },
    { id: 'b', appointment_at: '2026-10-12T10:30:00Z', duration: 90 },
    { id: 'c', appointment_at: '2026-10-12T11:00:00Z', duration: 90 },
    { id: 'cancelled', appointment_at: start, duration: 120, status: 'cancelled' },
    { id: 'later', appointment_at: '2026-10-12T13:00:00Z', duration: 30 },
  ];
  assert.deepEqual(appointmentColumns(appointments), { a: { column: 0, columns: 2 }, b: { column: 1, columns: 2 }, c: { column: 0, columns: 2 }, later: { column: 0, columns: 1 } });
});
