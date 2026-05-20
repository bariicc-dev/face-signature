'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Logo } from './Icon';

export function Nav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const items = [
    { k: '/', l: 'Accueil' },
    { k: '/prices', l: 'Tarifs' },
    { k: '/book', l: 'Réserver' },
    { k: '/location', l: 'Adresse' },
  ];

  return (
    <>
      <nav className={'nav ' + (scrolled ? 'scrolled' : '')}>
        <Link href="/"><Logo /></Link>
        <div className="nav-links">
          {items.map(i => (
            <Link key={i.k} href={i.k} className={path === i.k ? 'active' : ''}>{i.l}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/book" className="btn btn-gold btn-sm">Réserver</Link>
          <button className="icon-btn" style={{ display: 'inline-flex' }} onClick={() => setOpen(true)}>
            <Icon n="menu" s={15} />
          </button>
        </div>
      </nav>

      <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: open ? 'auto' : 'none' }}>
        <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', opacity: open ? 1 : 0, transition: 'opacity .35s' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(86vw, 340px)', background: 'var(--bg-2)', padding: 28, transform: `translateX(${open ? '0' : '100%'})`, transition: 'transform .4s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <Logo />
            <button className="icon-btn" onClick={() => setOpen(false)}><Icon n="close" s={15} /></button>
          </div>
          {items.map(i => (
            <Link key={i.k} href={i.k} onClick={() => setOpen(false)} style={{ padding: '18px 0', borderBottom: '1px solid var(--line)', fontSize: 18 }}>{i.l}</Link>
          ))}
        </div>
      </div>
    </>
  );
}
