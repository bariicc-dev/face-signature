import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Icon } from '@/components/Icon';
import { createAdminClient } from '@/lib/supabase-server';

function gcalLink(booking: any, serviceName: string, duration: number) {
  const start = new Date(booking.appointment_at);
  const end = new Date(start); end.setMinutes(end.getMinutes() + duration);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const text = encodeURIComponent('Face Signature — ' + serviceName);
  const details = encodeURIComponent(`Rendez-vous Face Signature\n${serviceName}\n${duration} min · ${booking.total}€`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${encodeURIComponent('152 Rue de Charenton, 75012 Paris')}`;
}

export default async function ConfirmPage({ searchParams }: { searchParams: { id?: string } }) {
  if (!searchParams.id) {
    return <NotFound />;
  }
  const sb = createAdminClient();
  const { data: booking } = await sb.from('bookings').select('*, services(*)').eq('id', searchParams.id).single();

  if (!booking) return <NotFound />;

  const d = new Date(booking.appointment_at);
  const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const svc = booking.services;

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '46px 28px' }}>
          <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--gold)', color: 'var(--ink)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop .7s cubic-bezier(.2,1.5,.4,1)' }}>
            <Icon n="check" s={36} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 500 }}>Confirmé</div>
          <h1 style={{ fontSize: 38, fontWeight: 300, letterSpacing: '-.02em', marginBottom: 14 }}>
            Merci <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, color: 'var(--gold)', fontSize: '1.15em' }}>✿</span>
          </h1>
          <p style={{ color: 'var(--mute)', marginBottom: 26 }}>
            Un email de confirmation vient de vous être envoyé. L'institut vous contactera pour valider.
          </p>

          <div className="summary" style={{ textAlign: 'left', background: 'var(--bg-3)' }}>
            <div className="summary-row"><span className="l">Référence</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>FS-{booking.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="summary-row"><span className="l">Soin</span><span>{svc?.name}</span></div>
            <div className="summary-row"><span className="l">Date</span><span style={{ textTransform: 'capitalize' }}>{dateStr}</span></div>
            <div className="summary-row"><span className="l">Heure</span><span>{timeStr}</span></div>
            <div className="summary-row"><span className="l">Total à régler sur place</span><span style={{ color: 'var(--gold)', fontWeight: 500 }}>{booking.total}€</span></div>
          </div>

          <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-3)', borderRadius: 10, fontSize: 13, color: 'var(--mute)', textAlign: 'left' }}>
            📍 152 Rue de Charenton, 75012 Paris
          </div>

          <a className="btn btn-gold" href={gcalLink(booking, svc.name, svc.duration)} target="_blank" rel="noreferrer" style={{ marginTop: 20, justifyContent: 'center', display: 'flex' }}>
            <Icon n="google" s={15} /> Ajouter à Google Calendar
          </a>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>Retour à l'accueil</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}

function NotFound() {
  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-head">
          <h1>Réservation introuvable</h1>
          <p>Cette page nécessite une référence valide.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link href="/book" className="btn btn-gold">Faire une réservation</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
