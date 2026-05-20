'use client';
import Link from 'next/link';
import { Logo } from './Icon';

export function Footer() {
  return (
    <footer style={{ padding: '50px 24px 30px', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
      <div style={{ marginBottom: 18, display: 'inline-block' }}><Link href="/"><Logo /></Link></div>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, fontSize: 13, color: 'var(--mute)' }}>
        <Link href="/prices">Tarifs</Link>
        <Link href="/book">Réserver</Link>
        <Link href="/location">Adresse</Link>
        <a href="https://wa.me/33695241807" target="_blank" rel="noreferrer">WhatsApp</a>
        <a href="tel:+33695241807">+33 6 95 24 18 07</a>
      </div>
      <div style={{ fontSize: 12, color: 'var(--mute)' }}>© 2026 Face Signature · 152 Rue de Charenton, 75012 Paris</div>
    </footer>
  );
}
