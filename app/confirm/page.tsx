import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { Icon } from '@/components/Icon';
import { createAdminClient } from '@/lib/supabase-server';

const ADDRESS = '152 Rue de Charenton, 75012 Paris';

function gcalLink(booking: any, serviceName: string, duration: number) {
  const start = new Date(booking.appointment_at);
  const end = new Date(start); end.setMinutes(end.getMinutes() + duration);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const text = encodeURIComponent('Face Signature - ' + serviceName);
  const details = encodeURIComponent(`Rendez-vous Face Signature\n${serviceName}\n${duration} min · ${booking.total}€\nRèglement sur place`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${encodeURIComponent(ADDRESS)}`;
}

export default async function ConfirmPage({ searchParams }: { searchParams: { id?: string } }) {
  if (!searchParams.id) {
    return <NotFound />;
  }
  const sb = createAdminClient();
  const { data: booking } = await sb.from('bookings').select('*, services(*)').eq('id', searchParams.id).single();

  if (!booking) return <NotFound />;

  const d = new Date(booking.appointment_at);
  const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const svc = booking.services;
  const serviceName = svc?.name || 'Soin Face Signature';
  const duration = svc?.duration || booking.duration || 60;
  const reference = `FS-${booking.id.slice(0, 8).toUpperCase()}`;
  const whatsappUrl = `https://wa.me/33695241807?text=${encodeURIComponent(`Bonjour Face Signature, j'ai une question concernant ma réservation ${reference}.`)}`;

  return (
    <>
      <Nav />
      <main className="page">
        <div style={{ maxWidth: 620, margin: '0 auto', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '42px 26px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--gold)', color: 'var(--ink)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop .7s cubic-bezier(.2,1.5,.4,1)' }}>
              <Icon n="check" s={36} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 500 }}>Demande reçue</div>
            <h1 style={{ fontSize: 'clamp(32px, 8vw, 42px)', fontWeight: 300, letterSpacing: 0, margin: '0 0 14px' }}>
              Votre rendez-vous est noté.
            </h1>
            <p style={{ color: 'var(--mute)', margin: '0 auto 26px', maxWidth: 470 }}>
              Un email de confirmation vient de vous être envoyé. L'institut vous contactera si un ajustement est nécessaire.
            </p>
          </div>

          <div className="summary" style={{ textAlign: 'left', background: 'var(--bg-3)', marginTop: 0 }}>
            <div className="summary-row"><span className="l">Référence</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{reference}</span></div>
            <div className="summary-row"><span className="l">Soin</span><span>{serviceName}</span></div>
            <div className="summary-row"><span className="l">Date</span><span style={{ textTransform: 'capitalize' }}>{dateStr}</span></div>
            <div className="summary-row"><span className="l">Heure</span><span>{timeStr}</span></div>
            <div className="summary-row"><span className="l">Durée</span><span>{duration} min</span></div>
            <div className="summary-row"><span className="l">Total à régler sur place</span><span style={{ color: 'var(--gold)', fontWeight: 500 }}>{booking.total}€</span></div>
          </div>

          <div style={{ marginTop: 16, padding: 16, background: 'rgba(245,237,224,.04)', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(201,165,114,.14)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon n="pin" s={16} /></div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Face Signature</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>{ADDRESS}</div>
              <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 8 }}>Aucun paiement en ligne. Le règlement se fait à l'institut.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }} className="form-grid-2">
            <a className="btn btn-gold" href={gcalLink(booking, serviceName, duration)} target="_blank" rel="noreferrer">
              <Icon n="google" s={15} /> Google Calendar
            </a>
            <a className="btn btn-ghost" href={whatsappUrl} target="_blank" rel="noreferrer">
              <Icon n="wa" s={15} /> WhatsApp
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }} className="form-grid-2">
            <a className="btn btn-ghost" href={`https://maps.google.com/?q=${encodeURIComponent(ADDRESS)}`} target="_blank" rel="noreferrer">Itinéraire <Icon n="arrow" s={14} /></a>
            <Link href="/" className="btn btn-primary">Accueil</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FabWA />
    </>
  );
}

function NotFound() {
  return (
    <>
      <Nav />
      <main className="page">
        <div className="page-head">
          <h1>Réservation introuvable</h1>
          <p>Cette page nécessite une référence valide.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link href="/book" className="btn btn-gold">Faire une réservation</Link>
        </div>
      </main>
      <Footer />
      <FabWA />
    </>
  );
}
