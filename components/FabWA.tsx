'use client';
import { Icon } from './Icon';

export function FabWA() {
  return (
    <a
      href="https://wa.me/33695241807"
      target="_blank"
      rel="noreferrer"
      style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 60,
        width: 56, height: 56, borderRadius: '50%',
        background: '#25D366', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 14px 30px -8px rgba(37,211,102,.5)',
      }}
    >
      <Icon n="wa" s={22} />
      <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid rgba(37,211,102,.4)', animation: 'pulse 2s infinite' }} />
    </a>
  );
}
