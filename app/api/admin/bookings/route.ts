import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase-server';
import { createCalendarEventForBooking } from '@/lib/google-calendar';
import { sendBookingEmails } from '@/lib/email';

function parsePositiveNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function overlaps(start: Date, duration: number, booking: { appointment_at: string; duration: number }) {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);
  const bookingStart = new Date(booking.appointment_at);
  const bookingEnd = new Date(bookingStart);
  bookingEnd.setMinutes(bookingEnd.getMinutes() + booking.duration);
  return start < bookingEnd && end > bookingStart;
}

export async function POST(req: NextRequest) {
  try {
    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const {
      serviceId,
      appointmentAt,
      name,
      phone,
      email,
      notes,
      status = 'confirmed',
      total,
      duration,
      sendClientEmail = false,
    } = body;

    if (!serviceId || !appointmentAt || !name || !phone) {
      return NextResponse.json({ error: 'Nom, téléphone, soin, date et heure sont requis' }, { status: 400 });
    }

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    if (sendClientEmail && !email) {
      return NextResponse.json({ error: 'Email requis pour envoyer une confirmation cliente' }, { status: 400 });
    }

    const sb = createAdminClient();
    const { data: svc, error: svcErr } = await sb.from('services').select('*').eq('id', serviceId).single();
    if (svcErr || !svc) {
      return NextResponse.json({ error: 'Soin introuvable' }, { status: 404 });
    }

    const start = new Date(appointmentAt);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 });
    }

    const finalDuration = parsePositiveNumber(duration, svc.duration);
    const finalTotal = parsePositiveNumber(total, svc.price);

    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
    const { data: sameDay } = await sb
      .from('bookings')
      .select('appointment_at, duration, status')
      .gte('appointment_at', dayStart.toISOString())
      .lte('appointment_at', dayEnd.toISOString())
      .neq('status', 'cancelled');

    const conflict = (sameDay || []).some((booking) => overlaps(start, finalDuration, booking));
    if (conflict) {
      return NextResponse.json({ error: 'Ce créneau est déjà occupé.' }, { status: 409 });
    }

    const { data: booking, error: insertErr } = await sb.from('bookings').insert({
      service_id: serviceId,
      client_name: String(name).trim(),
      client_email: email ? String(email).trim() : '',
      client_phone: String(phone).trim(),
      appointment_at: start.toISOString(),
      duration: finalDuration,
      total: finalTotal,
      notes: notes || null,
      status,
      is_new: false,
    }).select().single();

    if (insertErr || !booking) {
      console.error('Manual booking insert failed:', insertErr);
      return NextResponse.json({ error: 'Erreur lors de la création du RDV' }, { status: 500 });
    }

    const calendarSync = await createCalendarEventForBooking(booking, svc);
    const { error: calendarUpdateErr } = await sb
      .from('bookings')
      .update({
        calendar_sync_status: calendarSync.status,
        google_event_id: calendarSync.eventId || null,
        google_event_link: calendarSync.eventLink || null,
        calendar_sync_error: calendarSync.error || null,
      })
      .eq('id', booking.id);

    if (calendarUpdateErr) {
      console.error('Manual booking calendar metadata update failed:', calendarUpdateErr);
    }

    if (sendClientEmail) {
      sendBookingEmails({
        id: booking.id,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        clientPhone: booking.client_phone,
        serviceName: svc.name,
        serviceCategory: svc.category,
        appointmentAt: booking.appointment_at,
        duration: booking.duration,
        total: booking.total,
        notes: booking.notes,
        calendarSyncStatus: calendarSync.status,
        calendarEventLink: calendarSync.eventLink,
        calendarSyncError: calendarSync.error,
        sendClientEmail: true,
        sendAdminEmail: false,
      }).catch((error) => console.error('Manual booking client email failed:', error));
    }

    return NextResponse.json({
      ok: true,
      booking: {
        ...booking,
        calendar_sync_status: calendarSync.status,
        google_event_id: calendarSync.eventId || null,
        google_event_link: calendarSync.eventLink || null,
        calendar_sync_error: calendarSync.error || null,
        services: svc,
      },
    });
  } catch (error: any) {
    console.error('Manual booking failed:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
