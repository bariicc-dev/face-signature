export const BOOKING_CAPACITY = 2;
export const SALON_TIME_ZONE = 'Europe/Paris';
export type TreatmentMode = 'simultaneous' | 'sequential';
export type AvailabilityWindow = { start_at: string; end_at: string; kind: 'booking' | 'blocked' };
export type BlockedPeriod = { id: string; starts_at: string; ends_at: string; label: string };
export type Treatment = { id: string; name: string; category?: string; price: number; duration: number };

export function treatmentSummary(items: Treatment[], mode: TreatmentMode = 'simultaneous') {
  return {
    total: items.reduce((sum, item) => sum + item.price, 0),
    duration: mode === 'simultaneous'
      ? Math.max(0, ...items.map((item) => item.duration))
      : items.reduce((sum, item) => sum + item.duration, 0),
    name: items.map((item) => item.name).join(' + '),
  };
}

export function bookingServiceName(booking: { service_items?: Treatment[] | null; services?: { name: string } | null }) {
  return booking.service_items?.length ? booking.service_items.map((item) => item.name).join(' + ') : booking.services?.name || 'Soin Face Signature';
}

/** Place overlapping appointments beside each other, including staggered starts. */
export function appointmentColumns(bookings: { id: string; appointment_at: string; duration: number; status?: string }[]) {
  const result: Record<string, { column: number; columns: number }> = {};
  const sorted = bookings.filter((b) => b.status !== 'cancelled').sort((a, b) => Date.parse(a.appointment_at) - Date.parse(b.appointment_at));
  let group: typeof sorted = [];
  let groupEnd = 0;
  function flush() {
    const ends: number[] = [];
    for (const booking of group) {
      const start = Date.parse(booking.appointment_at);
      let column = ends.findIndex((end) => end <= start);
      if (column < 0) column = ends.length;
      ends[column] = start + booking.duration * 60_000;
      result[booking.id] = { column, columns: 1 };
    }
    for (const booking of group) result[booking.id].columns = ends.length;
    group = [];
  }
  for (const booking of sorted) {
    const start = Date.parse(booking.appointment_at);
    if (group.length && start >= groupEnd) flush();
    if (!group.length) groupEnd = 0;
    group.push(booking);
    groupEnd = Math.max(groupEnd, start + booking.duration * 60_000);
  }
  flush();
  return result;
}

/** Count the peak, not the total number of appointments intersecting a long visit. */
export function remainingPlaces(startAt: string, duration: number, windows: AvailabilityWindow[]) {
  const start = Date.parse(startAt);
  const end = start + duration * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return 0;
  const events: { time: number; delta: number }[] = [];
  for (const window of windows) {
    const from = Date.parse(window.start_at);
    const until = Date.parse(window.end_at);
    if (from >= end || until <= start) continue;
    if (window.kind === 'blocked') return 0;
    events.push({ time: Math.max(from, start), delta: 1 }, { time: Math.min(until, end), delta: -1 });
  }
  // An appointment ending at 11:00 releases its place for one starting at 11:00.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
  return Math.max(0, BOOKING_CAPACITY - peak);
}

function parisParts(date: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SALON_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(date));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function parisDateInput(date: Date | string = new Date()) {
  const p = parisParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function parisTimeInput(date: Date | string) {
  const p = parisParts(date);
  return `${p.hour}:${p.minute}`;
}

export function addCalendarDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Convert an institute wall-clock time, independently of the visitor's timezone. */
export function parisAppointment(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Date ou heure invalide');
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) throw new Error('Date ou heure invalide');
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const p = parisParts(new Date(instant));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    instant += wall - represented;
  }
  const result = new Date(instant).toISOString();
  if (parisDateInput(result) !== date || parisTimeInput(result) !== time) throw new Error('Date ou heure invalide');
  return result;
}

export function parisDayRange(date: string) {
  return { from: parisAppointment(date, '00:00'), until: parisAppointment(addCalendarDays(date, 1), '00:00') };
}
