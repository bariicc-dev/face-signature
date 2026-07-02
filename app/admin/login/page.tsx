'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Icon, Logo } from '@/components/Icon';

export default function AdminLogin() {
  const router = useRouter();
  const sb = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/admin');
      router.refresh();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Logo />
          <div style={{ marginTop: 18, fontSize: 12, color: 'var(--gold)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 500 }}>Espace administration</div>
        </div>

        <form onSubmit={submit} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 18, padding: 30 }}>
          <h1 style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-.02em', margin: '0 0 6px' }}>Connexion</h1>
          <p style={{ color: 'var(--mute)', fontSize: 14, marginBottom: 22 }}>Pour gérer vos rendez-vous.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email admin" autoComplete="email" required />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </div>
          </div>

          {error && (
            <div style={{ padding: 12, background: 'rgba(244,67,54,.1)', border: '1px solid #e57975', borderRadius: 10, color: '#e57975', fontSize: 13, marginBottom: 14 }}>
              {error === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Connexion…' : 'Se connecter'} <Icon n="arrow" s={13} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--mute)' }}>
          Face Signature · Espace privé
        </div>
      </div>
    </div>
  );
}
