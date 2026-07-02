'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Logo } from './Icon';

const items = [
  { k: '/', l: 'Accueil' },
  { k: '/prices', l: 'Tarifs' },
  { k: '/book', l: 'Réserver' },
  { k: '/location', l: 'Adresse' },
];

export function Nav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav className={'nav ' + (scrolled ? 'scrolled' : '')} aria-label="Navigation principale">
        <Link href="/" aria-label="Face Signature, accueil"><Logo /></Link>
        <div className="nav-links">
          {items.map(i => (
            <Link key={i.k} href={i.k} className={path === i.k ? 'active' : ''} aria-current={path === i.k ? 'page' : undefined}>{i.l}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/book" className="btn btn-gold btn-sm">Prendre rendez-vous</Link>
          <button className="icon-btn mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}>
            <Icon n="menu" s={15} />
          </button>
        </div>
      </nav>

      <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: open ? 'auto' : 'none' }} aria-hidden={!open}>
        <button aria-label="Fermer le menu" onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.55)', opacity: open ? 1 : 0, transition: 'opacity .35s' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(86vw, 340px)', background: 'var(--bg-2)', padding: 28, transform: `translateX(${open ? '0' : '100%'})`, transition: 'transform .4s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '-30px 0 80px rgba(0,0,0,.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Logo />
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer le menu"><Icon n="close" s={15} /></button>
          </div>
          {items.map(i => (
            <Link key={i.k} href={i.k} onClick={() => setOpen(false)} style={{ padding: '18px 0', borderBottom: '1px solid var(--line)', fontSize: 18, color: path === i.k ? 'var(--gold)' : 'var(--cream)' }}>
              {i.l}
            </Link>
          ))}
          <a href="https://wa.me/33695241807?text=Bonjour%20Face%20Signature%2C%20je%20souhaite%20un%20renseignement." target="_blank" rel="noreferrer" style={{ marginTop: 18, color: 'var(--mute)', fontSize: 14 }}>
            WhatsApp · +33 6 95 24 18 07
          </a>
        </div>
      </div>
    </>
  );
}
