'use client';
import Link from 'next/link';
import { Logo } from './Icon';

const WHATSAPP_URL = 'https://wa.me/33695241807?text=Bonjour%20Face%20Signature%2C%20je%20souhaite%20un%20renseignement.';

export function Footer() {
  return (
    <footer style={{ padding: '52px 24px 32px', background: 'var(--bg-2)', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 26 }} className="loc-grid">
        <div>
          <div style={{ marginBottom: 16 }}><Link href="/" aria-label="Face Signature, accueil"><Logo /></Link></div>
          <p style={{ color: 'var(--mute)', fontSize: 13, maxWidth: 360, margin: 0 }}>
            Institut de beauté à Paris 12e pour sourcils, lèvres, regard, cils et blanchiment.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 12 }}>Navigation</div>
          <div style={{ display: 'grid', gap: 9, fontSize: 13, color: 'var(--mute)' }}>
            <Link href="/prices">Tarifs</Link>
            <Link href="/book">Prendre rendez-vous</Link>
            <Link href="/location">Adresse</Link>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 12 }}>Contact</div>
          <div style={{ display: 'grid', gap: 9, fontSize: 13, color: 'var(--mute)' }}>
            <a href="tel:+33695241807">+33 6 95 24 18 07</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="https://maps.google.com/?q=152+Rue+de+Charenton+75012+Paris" target="_blank" rel="noreferrer">152 Rue de Charenton, 75012 Paris</a>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1080, margin: '30px auto 0', paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--mute)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>© 2026 Face Signature</span>
        <span>Réservation sans paiement en ligne</span>
      </div>
    </footer>
  );
}
