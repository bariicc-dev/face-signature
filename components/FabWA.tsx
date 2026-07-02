'use client';
import { Icon } from './Icon';

const WHATSAPP_URL = 'https://wa.me/33695241807?text=Bonjour%20Face%20Signature%2C%20je%20souhaite%20un%20renseignement.';

export function FabWA() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Contacter Face Signature sur WhatsApp"
      title="WhatsApp"
      style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 60,
        width: 54, height: 54, borderRadius: '50%',
        background: '#25D366', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 14px 30px -10px rgba(37,211,102,.55)',
      }}
    >
      <Icon n="wa" s={22} />
      <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px solid rgba(37,211,102,.32)', animation: 'pulse 2.8s infinite' }} />
    </a>
  );
}
