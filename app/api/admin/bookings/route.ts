import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase-server';
import { sendBookingEmails } from '@/lib/email';

type BookingWindow = {
  id?: string;
  appointment_at: string;
  duration: number;
};

function parsePositiveNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function getEnd(start: Date, duration: number) {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);
  return end;
}

function overlaps(start: Date, duration: number, booking: BookingWindow) {
  const end = getEnd(start, duration);
  const bookingStart = new Date(booking.appointment_at);
  const bookingEnd = getEnd(bookingStart, booking.duration);
  return start < bookingEnd && end > bookingStart;
}

async function requireAdmin() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

async function hasConflict(sb: ReturnType<typeof createAdminClient>, start: Date, duration: number, excludeId?: string) {
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);

  let query = sb
    .from('bookings')
    .select('id, appointment_at, duration, status')
    .gte('appointment_at', dayStart.toISOString())
    .lte('appointment_at', dayEnd.toISOString())
    .neq('status', 'cancelled');

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).some((booking) => overlaps(start, duration, booking));
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

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
      return NextResponse.json({ error: 'Nom, telephone, soin, date et heure sont requis' }, { status: 400 });
    }

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    if (sendClientEmail && !email) {
      return NextResponse.json({ error: 'Email requis pour envoyer une confirmation cliente' }, { status: 400 });
    }

    const sb = createAdminClient();
    const { data: svc, error: svcErr } = await sb.from('services').select('*').eq('id', serviceId).single();
    if (svcErr || !svc) return NextResponse.json({ error: 'Soin introuvable' }, { status: 404 });

    const start = new Date(appointmentAt);
    if (Number.isNaN(start.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 });

    const finalDuration = parsePositiveNumber(duration, svc.duration);
    const finalTotal = parsePositiveNumber(total, svc.price);

    if (await hasConflict(sb, start, finalDuration)) {
      return NextResponse.json({ error: 'Ce creneau est deja occupe.' }, { status: 409 });
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
    }).select('*, services(*)').single();

    if (insertErr || !booking) {
      console.error('Manual booking insert failed:', insertErr);
      return NextResponse.json({ error: 'Erreur lors de la creation du RDV' }, { status: 500 });
    }

    if (sendClientEmail) {
      sendBookingEmails({
        id: booking.id,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        clientPhone: booking.client_phone,
        serviceName: booking.services?.name || svc.name,
        serviceCategory: booking.services?.category || svc.category,
        appointmentAt: booking.appointment_at,
        duration: booking.duration,
        total: booking.total,
        notes: booking.notes,
        sendClientEmail: true,
        sendAdminEmail: false,
      }).catch((error) => console.error('Manual booking client email failed:', error));
    }

    return NextResponse.json({ ok: true, booking });
  } catch (error: any) {
    console.error('Manual booking failed:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const body = await req.json();
    const { id, appointmentAt, duration, status, total, notes } = body;
    if (!id) return NextResponse.json({ error: 'RDV introuvable' }, { status: 400 });

    const sb = createAdminClient();
    const { data: existing, error: existingErr } = await sb.from('bookings').select('*').eq('id', id).single();
    if (existingErr || !existing) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (status) {
      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
      }
      update.status = status;
      if (status !== 'pending') update.is_new = false;
    }
    if (typeof total !== 'undefined') update.total = parsePositiveNumber(total, existing.total);
    if (typeof notes !== 'undefined') update.notes = notes || null;
    if (typeof duration !== 'undefined') update.duration = parsePositiveNumber(duration, existing.duration);
    if (appointmentAt) update.appointment_at = new Date(appointmentAt).toISOString();

    const nextStart = new Date((update.appointment_at as string) || existing.appointment_at);
    const nextDuration = Number(update.duration || existing.duration);
    if (Number.isNaN(nextStart.getTime())) return NextResponse.json({ error: 'Date invalide' }, { status: 400 });

    if ((appointmentAt || duration) && await hasConflict(sb, nextStart, nextDuration, id)) {
      return NextResponse.json({ error: 'Ce creneau est deja occupe.' }, { status: 409 });
    }

    const { data: booking, error: updateErr } = await sb
      .from('bookings')
      .update(update)
      .eq('id', id)
      .select('*, services(*)')
      .single();

    if (updateErr || !booking) {
      console.error('Booking update failed:', updateErr);
      return NextResponse.json({ error: 'Mise a jour impossible' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking });
  } catch (error: any) {
    console.error('Booking update failed:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'RDV introuvable' }, { status: 400 });

    const sb = createAdminClient();
    const { error } = await sb.from('bookings').delete().eq('id', id);
    if (error) {
      console.error('Booking delete failed:', error);
      return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (error: any) {
    console.error('Booking delete failed:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
