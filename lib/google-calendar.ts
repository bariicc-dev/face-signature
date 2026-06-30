import 'server-only';
import crypto from 'crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const LOCATION = '152 Rue de Charenton, 75012 Paris';
const TIME_ZONE = 'Europe/Paris';

type BookingForCalendar = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  appointment_at: string;
  duration: number;
  total: number;
  notes?: string | null;
};

type ServiceForCalendar = {
  name: string;
  category?: string | null;
  price?: number | null;
  duration?: number | null;
};

export type CalendarSyncResult = {
  ok: boolean;
  status: 'synced' | 'error' | 'skipped';
  eventId?: string;
  eventLink?: string;
  error?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  htmlLink?: string;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return trimmed.replace(/\\n/g, '\n');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.includes('BEGIN PRIVATE KEY')) {
      return decoded.replace(/\\n/g, '\n');
    }
  } catch {}

  return trimmed.replace(/\\n/g, '\n');
}

function getCalendarConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!calendarId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    calendarId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function createEventId(bookingId: string) {
  const hash = crypto.createHash('sha256').update(`face-signature:${bookingId}`).digest('hex');
  return `facesig${hash.slice(0, 40)}`;
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth token request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload.access_token as string;
}

async function fetchExistingEvent(calendarId: string, eventId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Calendar duplicate lookup failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GoogleCalendarEvent;
}

function buildDescription(booking: BookingForCalendar, service: ServiceForCalendar) {
  const reference = `FS-${booking.id.slice(0, 8).toUpperCase()}`;
  return [
    `Cliente: ${booking.client_name}`,
    `Téléphone: ${booking.client_phone}`,
    `Email: ${booking.client_email}`,
    `Soin: ${service.name}`,
    service.category ? `Catégorie: ${service.category}` : null,
    `Prix: ${booking.total ?? service.price ?? ''}€`,
    `Durée: ${booking.duration ?? service.duration} min`,
    booking.notes ? `Notes: ${booking.notes}` : 'Notes: -',
    `Référence: ${reference}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function createCalendarEventForBooking(
  booking: BookingForCalendar,
  service: ServiceForCalendar
): Promise<CalendarSyncResult> {
  const config = getCalendarConfig();
  if (!config) {
    const message = 'Google Calendar sync skipped: GOOGLE_CALENDAR_ID or service account credentials are missing.';
    console.warn(message);
    return { ok: false, status: 'skipped', error: message };
  }

  try {
    const start = new Date(booking.appointment_at);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + Number(booking.duration || service.duration || 0));

    const eventId = createEventId(booking.id);
    const accessToken = await getAccessToken(config.clientEmail, config.privateKey);
    const eventBody = {
      id: eventId,
      summary: `Face Signature — ${service.name} — ${booking.client_name}`,
      location: LOCATION,
      description: buildDescription(booking, service),
      start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=none`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (response.status === 409) {
      const existing = await fetchExistingEvent(config.calendarId, eventId, accessToken);
      return { ok: true, status: 'synced', eventId: existing.id || eventId, eventLink: existing.htmlLink };
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Google Calendar event insert failed (${response.status}): ${JSON.stringify(payload)}`);
    }

    return { ok: true, status: 'synced', eventId: payload.id || eventId, eventLink: payload.htmlLink };
  } catch (error: any) {
    const message = error?.message || 'Google Calendar event creation failed';
    console.error('Google Calendar event creation failed:', error);
    return { ok: false, status: 'error', error: message };
  }
}
