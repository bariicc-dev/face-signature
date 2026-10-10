import { NextResponse } from 'next/server';
import { createAdminClient } from './supabase-server';
import { getOfficialService, serviceUpsertPayload } from './services';
import { treatmentSummary, type TreatmentMode } from './scheduling';

export class BookingInputError extends Error {}

export async function resolveTreatments(sb: ReturnType<typeof createAdminClient>, body: Record<string, unknown>) {
  const ids = body.serviceIds ?? (body.serviceId ? [body.serviceId] : []);
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 18 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new BookingInputError('Choisissez une ou plusieurs prestations différentes.');
  }
  const mode = body.treatmentMode ?? 'simultaneous';
  if (mode !== 'simultaneous' && mode !== 'sequential') throw new BookingInputError('Organisation des prestations invalide.');
  const services = ids.map((id) => getOfficialService(id));
  if (services.some((service) => !service?.active)) throw new BookingInputError('Prestation introuvable.');
  const items = services.map((service) => ({ id: service!.id, name: service!.name, category: service!.category, price: service!.price, duration: service!.duration }));
  const { error } = await sb.from('services').upsert(services.map((service) => serviceUpsertPayload(service!)), { onConflict: 'id' });
  if (error) throw error;
  return { items, mode: mode as TreatmentMode, ...treatmentSummary(items, mode) };
}

export function bookingError(error: { code?: string; message?: string } | unknown) {
  const issue = error as { code?: string; message?: string };
  const message = issue?.message || '';
  if (error instanceof BookingInputError) return NextResponse.json({ error: message }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  if (message.includes('FS_BLOCK_HAS_BOOKINGS')) return NextResponse.json({ error: 'Des RDV existent sur cette période. Déplacez-les ou annulez-les avant de la bloquer.' }, { status: 409 });
  if (message.includes('FS_BLOCKED')) return NextResponse.json({ error: 'L’institut est indisponible sur cette période. Choisissez un autre créneau.' }, { status: 409 });
  if (message.includes('FS_CAPACITY') || issue?.code === '23P01') return NextResponse.json({ error: 'Les deux places sont déjà réservées sur ce créneau. Choisissez une autre heure.' }, { status: 409 });
  console.error('Scheduling request failed:', error);
  return NextResponse.json({ error: 'Action impossible pour le moment. Veuillez réessayer.' }, { status: 500 });
}

export function validDuration(value: unknown, fallback: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 1440) throw new BookingInputError('La durée doit être comprise entre 1 et 1440 minutes.');
  return number;
}

export function validTotal(value: unknown, fallback: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) throw new BookingInputError('Prix invalide.');
  return number;
}

export function validAppointment(value: unknown) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) throw new BookingInputError('Date invalide.');
  return new Date(value).toISOString();
}
