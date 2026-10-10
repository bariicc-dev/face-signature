import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase-server';
import { sendBookingEmails } from '@/lib/email';
import { BookingInputError, bookingError, resolveTreatments, validAppointment, validDuration, validTotal } from '@/lib/booking-server';
import { bookingServiceName } from '@/lib/scheduling';

const STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];
async function requireAdmin() {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const status = body.status ?? 'confirmed';
    if (!name || !phone) throw new BookingInputError('Nom et téléphone sont requis.');
    if (!STATUSES.includes(status)) throw new BookingInputError('Statut invalide.');
    if (body.sendClientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BookingInputError('Email valide requis pour envoyer une confirmation.');
    const appointmentAt = validAppointment(body.appointmentAt);
    const sb = createAdminClient();
    const selection = await resolveTreatments(sb, body);
    const { data: booking, error } = await sb.from('bookings').insert({
      service_id: selection.items[0].id, service_items: selection.items, treatment_mode: selection.mode,
      client_name: name, client_email: email, client_phone: phone,
      appointment_at: appointmentAt, duration: validDuration(body.duration, selection.duration),
      total: validTotal(body.total, selection.total), notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      status, is_new: false,
    }).select('*, services(*)').single();
    if (error) throw error;
    if (!booking) throw new Error('Booking insert returned no result');
    if (body.sendClientEmail) {
      await sendBookingEmails({
        id: booking.id, clientName: booking.client_name, clientEmail: booking.client_email, clientPhone: booking.client_phone,
        serviceName: bookingServiceName(booking), serviceCategory: selection.items.map((item) => item.category).join(' / '),
        appointmentAt: booking.appointment_at, duration: booking.duration, total: booking.total, notes: booking.notes,
        sendClientEmail: true, sendAdminEmail: false,
      }).catch((error) => console.error('Manual booking email failed:', error));
    }
    return NextResponse.json({ ok: true, booking }, { status: 201 });
  } catch (error) { return bookingError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    const body = await req.json();
    if (!body.id) throw new BookingInputError('RDV introuvable.');
    const sb = createAdminClient();
    const { data: existing, error: lookupError } = await sb.from('bookings').select('*').eq('id', body.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: 'RDV introuvable.' }, { status: 404 });
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) throw new BookingInputError('Statut invalide.');
      update.status = body.status;
      if (body.status !== 'pending') update.is_new = false;
    }
    if (body.appointmentAt !== undefined) update.appointment_at = validAppointment(body.appointmentAt);
    if (body.duration !== undefined) update.duration = validDuration(body.duration, existing.duration);
    if (body.total !== undefined) update.total = validTotal(body.total, existing.total);
    if (body.notes !== undefined) update.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    if (!Object.keys(update).length) throw new BookingInputError('Aucune modification fournie.');
    // All changes, including restoring a cancelled RDV, are guarded by the same DB rules.
    const { data: booking, error } = await sb.from('bookings').update(update).eq('id', body.id).select('*, services(*)').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, booking });
  } catch (error) { return bookingError(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id');
    if (!id) throw new BookingInputError('RDV introuvable.');
    const { data, error } = await createAdminClient().from('bookings').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'RDV introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (error) { return bookingError(error); }
}
