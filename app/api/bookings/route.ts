import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { sendBookingEmails } from '@/lib/email';
import { createCalendarEventForBooking } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, appointmentAt, name, email, phone, notes } = body;

    if (!serviceId || !appointmentAt || !name || !email || !phone) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const sb = createAdminClient();

    // Load service to get price & duration
    const { data: svc, error: svcErr } = await sb.from('services').select('*').eq('id', serviceId).single();
    if (svcErr || !svc) {
      return NextResponse.json({ error: 'Soin introuvable' }, { status: 404 });
    }

    // Conflict check: any non-cancelled booking that overlaps?
    const start = new Date(appointmentAt);
    const end = new Date(start); end.setMinutes(end.getMinutes() + svc.duration);

    // Pull bookings on that day
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);

    const { data: sameDay } = await sb
      .from('bookings')
      .select('appointment_at, duration, status')
      .gte('appointment_at', dayStart.toISOString())
      .lte('appointment_at', dayEnd.toISOString())
      .neq('status', 'cancelled');

    const conflict = (sameDay || []).some(b => {
      const bs = new Date(b.appointment_at);
      const be = new Date(bs); be.setMinutes(be.getMinutes() + b.duration);
      return start < be && end > bs;
    });

    if (conflict) {
      return NextResponse.json({ error: 'Ce créneau vient d\'être pris. Veuillez en choisir un autre.' }, { status: 409 });
    }

    // Insert booking first. Calendar/email failures must never erase the booking.
    const { data: booking, error: insErr } = await sb.from('bookings').insert({
      service_id: serviceId,
      client_name: name,
      client_email: email,
      client_phone: phone,
      appointment_at: start.toISOString(),
      duration: svc.duration,
      total: svc.price,
      notes: notes || null,
      status: 'pending',
      is_new: true,
    }).select().single();

    if (insErr || !booking) {
      console.error(insErr);
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
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
      console.error('Calendar sync metadata update failed:', calendarUpdateErr);
    }

    // Send emails (don't block on failure)
    sendBookingEmails({
      id: booking.id,
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      serviceName: svc.name,
      serviceCategory: svc.category,
      appointmentAt: booking.appointment_at,
      duration: svc.duration,
      total: svc.price,
      notes,
      calendarSyncStatus: calendarSync.status,
      calendarEventLink: calendarSync.eventLink,
      calendarSyncError: calendarSync.error,
    }).catch(e => console.error('Email send failed:', e));

    return NextResponse.json({
      id: booking.id,
      ok: true,
      calendar: {
        status: calendarSync.status,
        eventLink: calendarSync.eventLink || null,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
