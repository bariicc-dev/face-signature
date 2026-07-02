import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const ADMIN = process.env.ADMIN_EMAIL || 'admin@example.com';

function formatDateFr(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTimeFr(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Shared email shell
const shell = (title: string, content: string) => `
<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f5ede0;font-family:-apple-system,'Inter',sans-serif;color:#0f0d0c;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:30px;">
      <div style="font-size:24px;letter-spacing:-.02em;font-weight:500;color:#0f0d0c;">
        Face <span style="font-family:'Dancing Script',cursive;font-size:32px;color:#c9a572;">Signature</span>
      </div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:34px;box-shadow:0 4px 24px rgba(0,0,0,.04);">
      ${content}
    </div>
    <div style="text-align:center;margin-top:30px;font-size:12px;color:#8a7e72;line-height:1.6;">
      Face Signature · 152 Rue de Charenton, 75012 Paris<br/>
      +33 6 95 24 18 07
    </div>
  </div>
</body>
</html>`;

export async function sendBookingEmails(booking: {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  serviceCategory: string;
  appointmentAt: string; // ISO
  duration: number;
  total: number;
  notes?: string | null;
  sendClientEmail?: boolean;
  sendAdminEmail?: boolean;
}) {
  const d = new Date(booking.appointmentAt);
  const dateStr = formatDateFr(d);
  const timeStr = formatTimeFr(d);
  const ref = `FS-${booking.id.slice(0, 8).toUpperCase()}`;

  // Google Calendar link
  const end = new Date(d);
  end.setMinutes(end.getMinutes() + booking.duration);
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    'Face Signature — ' + booking.serviceName
  )}&dates=${fmt(d)}/${fmt(end)}&details=${encodeURIComponent(
    `Rendez-vous Face Signature\n${booking.serviceName}\nDurée: ${booking.duration} min\nPrix: ${booking.total}€`
  )}&location=${encodeURIComponent('152 Rue de Charenton, 75012 Paris')}`;

  // === Client email ===
  const clientHtml = shell(
    'Votre rendez-vous est confirmé',
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:60px;height:60px;border-radius:50%;background:#c9a572;color:#fff;font-size:28px;line-height:60px;text-align:center;">✓</div>
    </div>
    <h1 style="font-size:26px;font-weight:300;letter-spacing:-.02em;text-align:center;margin:0 0 8px;">Votre rendez-vous est confirmé</h1>
    <p style="text-align:center;color:#8a7e72;margin:0 0 28px;">Merci ${booking.clientName.split(' ')[0]}, à très vite ✿</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:10px 0;color:#8a7e72;">Référence</td><td style="padding:10px 0;text-align:right;font-family:monospace;">${ref}</td></tr>
      <tr><td style="padding:10px 0;color:#8a7e72;border-top:1px dashed #e8dccb;">Soin</td><td style="padding:10px 0;text-align:right;border-top:1px dashed #e8dccb;">${booking.serviceName}</td></tr>
      <tr><td style="padding:10px 0;color:#8a7e72;border-top:1px dashed #e8dccb;">Date</td><td style="padding:10px 0;text-align:right;border-top:1px dashed #e8dccb;text-transform:capitalize;">${dateStr}</td></tr>
      <tr><td style="padding:10px 0;color:#8a7e72;border-top:1px dashed #e8dccb;">Heure</td><td style="padding:10px 0;text-align:right;border-top:1px dashed #e8dccb;">${timeStr}</td></tr>
      <tr><td style="padding:10px 0;color:#8a7e72;border-top:1px dashed #e8dccb;">Durée</td><td style="padding:10px 0;text-align:right;border-top:1px dashed #e8dccb;">${booking.duration} min</td></tr>
      <tr><td style="padding:10px 0;color:#8a7e72;border-top:1px solid #0f0d0c;font-weight:500;">À régler sur place</td><td style="padding:10px 0;text-align:right;border-top:1px solid #0f0d0c;color:#c9a572;font-size:20px;font-weight:500;">${booking.total}€</td></tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="${gcal}" style="display:inline-block;background:#c9a572;color:#0f0d0c;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:500;">
        Ajouter à Google Calendar
      </a>
    </div>

    <div style="margin-top:20px;padding:14px;background:#f5ede0;border-radius:10px;font-size:13px;color:#8a7e72;text-align:center;">
      📍 152 Rue de Charenton, 75012 Paris<br/>
      📞 +33 6 95 24 18 07
    </div>
  `
  );

  // === Admin email ===
  const adminHtml = shell(
    `Nouvelle réservation — ${booking.clientName}`,
    `
    <div style="background:#fff8e8;border:1px solid #c9a572;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#7a5d3f;">
      ✨ Nouvelle réservation à confirmer
    </div>
    <h1 style="font-size:22px;font-weight:500;letter-spacing:-.01em;margin:0 0 24px;">Nouvelle réservation</h1>

    <h3 style="font-size:13px;color:#8a7e72;letter-spacing:.08em;text-transform:uppercase;margin:0 0 10px;font-weight:500;">Cliente</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#8a7e72;width:120px;">Nom</td><td style="padding:6px 0;">${booking.clientName}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Email</td><td style="padding:6px 0;"><a href="mailto:${booking.clientEmail}" style="color:#c9a572;">${booking.clientEmail}</a></td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Téléphone</td><td style="padding:6px 0;"><a href="tel:${booking.clientPhone}" style="color:#c9a572;">${booking.clientPhone}</a></td></tr>
    </table>

    <h3 style="font-size:13px;color:#8a7e72;letter-spacing:.08em;text-transform:uppercase;margin:0 0 10px;font-weight:500;">Rendez-vous</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#8a7e72;width:120px;">Référence</td><td style="padding:6px 0;font-family:monospace;">${ref}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Soin</td><td style="padding:6px 0;">${booking.serviceName}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Catégorie</td><td style="padding:6px 0;">${booking.serviceCategory}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Date</td><td style="padding:6px 0;text-transform:capitalize;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Heure</td><td style="padding:6px 0;">${timeStr}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Durée</td><td style="padding:6px 0;">${booking.duration} min</td></tr>
      <tr><td style="padding:6px 0;color:#8a7e72;">Total</td><td style="padding:6px 0;color:#c9a572;font-weight:500;">${booking.total}€</td></tr>
      ${booking.notes ? `<tr><td style="padding:6px 0;color:#8a7e72;vertical-align:top;">Notes</td><td style="padding:6px 0;">${booking.notes}</td></tr>` : ''}
    </table>

    <div style="display:flex;gap:8px;margin-top:24px;">
      <a href="${gcal}" style="flex:1;display:inline-block;background:#c9a572;color:#0f0d0c;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:13px;font-weight:500;text-align:center;">📅 Google Calendar</a>
      <a href="https://wa.me/${booking.clientPhone.replace(/\D/g, '')}" style="flex:1;display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:13px;font-weight:500;text-align:center;">💬 WhatsApp</a>
    </div>

    <div style="margin-top:20px;padding:12px;background:#f5ede0;border-radius:8px;font-size:12px;color:#8a7e72;text-align:center;">
      Connectez-vous à l'admin pour confirmer ou annuler
    </div>
  `
  );

  const sendClientEmail = booking.sendClientEmail ?? true;
  const sendAdminEmail = booking.sendAdminEmail ?? true;
  const sends = [];

  if (sendClientEmail && booking.clientEmail) {
    sends.push(
      resend.emails.send({
        from: `Face Signature <${FROM}>`,
        to: booking.clientEmail,
        subject: `Votre rendez-vous chez Face Signature — ${dateStr}`,
        html: clientHtml,
      })
    );
  }

  if (sendAdminEmail) {
    sends.push(
      resend.emails.send({
        from: `Face Signature <${FROM}>`,
        to: ADMIN,
        subject: `🌸 Nouvelle réservation — ${booking.clientName} (${dateStr})`,
        html: adminHtml,
        replyTo: booking.clientEmail || undefined,
      })
    );
  }

  if (sends.length === 0) {
    return { ok: true, skipped: true };
  }

  // Send selected notifications
  try {
    await Promise.all(sends);
    return { ok: true };
  } catch (e: any) {
    console.error('Email send failed:', e);
    return { ok: false, error: e.message };
  }
}
