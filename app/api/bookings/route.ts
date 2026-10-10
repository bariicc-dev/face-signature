import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { sendBookingEmails } from '@/lib/email';
import { BookingInputError, bookingError, resolveTreatments, validAppointment } from '@/lib/booking-server';
import { parisDateInput, parisTimeInput, parisAppointment } from '@/lib/scheduling';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 9) {
      throw new BookingInputError('Renseignez votre nom, un email valide et un téléphone.');
    }
    const appointmentAt = validAppointment(body.appointmentAt);
    const sb = createAdminClient();
    const selection = await resolveTreatments(sb, body);
    const time = parisTimeInput(appointmentAt);
    const closing = parisAppointment(parisDateInput(appointmentAt), '20:00');
    if (Date.parse(appointmentAt) <= Date.now() || time < '10:00' || time > '18:00' || !['00', '30'].includes(time.slice(3)) || Date.parse(appointmentAt) + selection.duration * 60000 > Date.parse(closing)) {
      throw new BookingInputError('Choisissez un créneau disponible pendant les horaires d’ouverture.');
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    // The database serializes schedule writes and checks capacity and closures atomically.
    const { data: booking, error } = await sb.from('bookings').insert({
      service_id: selection.items[0].id,
      service_items: selection.items,
      treatment_mode: selection.mode,
      client_name: name,
      client_email: email,
      client_phone: phone,
      appointment_at: appointmentAt,
      duration: selection.duration,
      total: selection.total,
      notes: notes || null,
      status: 'pending',
      is_new: true,
    }).select().single();
    if (error) throw error;
    if (!booking) throw new Error('Booking insert returned no result');

    await sendBookingEmails({
      id: booking.id, clientName: name, clientEmail: email, clientPhone: phone,
      serviceName: selection.name, serviceCategory: Array.from(new Set(selection.items.map((item) => item.category))).join(' / '),
      appointmentAt: booking.appointment_at, duration: booking.duration, total: booking.total, notes,
    }).catch((error) => console.error('Booking email failed:', error));
    return NextResponse.json({ id: booking.id, ok: true }, { status: 201 });
  } catch (error) { return bookingError(error); }
}
