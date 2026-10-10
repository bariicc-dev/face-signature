import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase-server';
import { BookingInputError, bookingError, validAppointment } from '@/lib/booking-server';

async function requireAdmin() {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    const body = await req.json();
    const startsAt = validAppointment(body.startsAt);
    const endsAt = validAppointment(body.endsAt);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new BookingInputError('La fin doit être après le début.');
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '';
    const { data, error } = await createAdminClient().from('blocked_periods').insert({ starts_at: startsAt, ends_at: endsAt, label: label || 'Indisponible' }).select().single();
    if (error) throw error;
    return NextResponse.json({ period: data }, { status: 201 });
  } catch (error) { return bookingError(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new BookingInputError('Période introuvable.');
    const { data, error } = await createAdminClient().from('blocked_periods').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Période introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (error) { return bookingError(error); }
}
