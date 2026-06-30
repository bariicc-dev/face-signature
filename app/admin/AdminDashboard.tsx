'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase-browser';

type Booking = any;
type Tab = 'today' | 'appts' | 'clients' | 'settings';

function clearToast(setToast: (v: string | null) => void, message: string) {
  setToast(message);
  setTimeout(() => setToast(null), 2600);
}

function whatsappPhone(value: string) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('33')) return digits;
  if (digits.startsWith('0')) return `33${digits.slice(1)}`;
  return digits;
}

function money(value: number) {
  return `${value || 0}€`;
}

export function AdminDashboard({ user, initialBookings, services }: { user: any; initialBookings: Booking[]; services: any[] }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState<string | null>(null);
  const sb = createClient();

  useEffect(() => {
    const channel = sb
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, async (payload) => {
        const { data } = await sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false });
        if (data) setBookings(data);
        if (payload.eventType === 'INSERT') clearToast(setToast, 'Nouvelle réservation reçue');
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  const newCount = bookings.filter(b => b.is_new && b.status === 'pending').length;

  const updateBooking = async (id: string, fields: any) => {
    const { error } = await sb.from('bookings').update(fields).eq('id', id);
    if (error) { clearToast(setToast, 'Action impossible, réessayez'); return; }
    setBookings(b => b.map(x => x.id === id ? { ...x, ...fields } : x));
  };

  const markRead = (id: string) => updateBooking(id, { is_new: false });
  const confirmBooking = (id: string) => { updateBooking(id, { status: 'confirmed', is_new: false }); clearToast(setToast, 'Rendez-vous confirmé'); };
  const cancelBooking = (id: string) => { updateBooking(id, { status: 'cancelled', is_new: false }); clearToast(setToast, 'Rendez-vous annulé'); };
  const completeBooking = (id: string) => { updateBooking(id, { status: 'completed', is_new: false }); clearToast(setToast, 'Rendez-vous terminé'); };

  const signout = async () => {
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const navItems = [
    { k: 'today', l: "Aujourd'hui", i: 'dash', badge: newCount },
    { k: 'appts', l: 'RDV', i: 'calendar' },
    { k: 'clients', l: 'Clientes', i: 'users' },
    { k: 'settings', l: 'Réglages', i: 'settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 94, background: 'linear-gradient(180deg, var(--bg), #141110)' }}>
      <header style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', background: 'rgba(23,20,19,.94)', position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(20px)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>Espace privé</div>
          <div style={{ fontSize: 21, fontWeight: 500, letterSpacing: 0, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Face Signature
            {newCount > 0 && (
              <span style={{ background: 'var(--gold)', color: 'var(--ink)', fontSize: 10.5, padding: '4px 9px', borderRadius: 999, fontWeight: 700 }}>
                {newCount} à confirmer
              </span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={signout} title="Déconnexion" aria-label="Déconnexion"><Icon n="logout" s={15} /></button>
      </header>

      <div style={{ padding: '18px', maxWidth: 1060, margin: '0 auto' }}>
        {tab === 'today' && <TabToday bookings={bookings} services={services} onConfirm={confirmBooking} onCancel={cancelBooking} onComplete={completeBooking} onView={markRead} />}
        {tab === 'appts' && <TabAppointments bookings={bookings} onConfirm={confirmBooking} onCancel={cancelBooking} onComplete={completeBooking} />}
        {tab === 'clients' && <TabClients bookings={bookings} />}
        {tab === 'settings' && <TabSettings user={user} />}
      </div>

      <nav aria-label="Navigation admin" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, background: 'rgba(23,20,19,.96)', borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '8px 8px env(safe-area-inset-bottom)', backdropFilter: 'blur(20px)' }}>
        {navItems.map(t => (
          <button key={t.k} type="button" onClick={() => setTab(t.k as Tab)} aria-current={tab === t.k ? 'page' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', fontSize: 10.5, color: tab === t.k ? 'var(--gold)' : 'var(--mute)', cursor: 'pointer', borderRadius: 10, position: 'relative' }}>
            {tab === t.k && <span style={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2, background: 'var(--gold)', borderRadius: '0 0 4px 4px' }} />}
            <Icon n={t.i} s={20} />
            <span>{t.l}</span>
            {!!t.badge && t.badge > 0 && (
              <span style={{ position: 'absolute', top: 4, right: '25%', background: 'var(--gold)', color: 'var(--ink)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast-wrap">
          <div className="toast in"><div className="ic"><Icon n="check" s={14} /></div><span>{toast}</span></div>
        </div>
      )}
    </div>
  );
}

function ApptCard({ appt, isNew, onConfirm, onCancel, onComplete, onView }: any) {
  const svc = appt.services;
  const d = new Date(appt.appointment_at);
  const phone = whatsappPhone(appt.client_phone || '');
  const isPast = d < new Date();

  return (
    <article
      style={{
        background: isNew ? 'rgba(201,165,114,.075)' : 'var(--bg-2)',
        border: isNew ? '1px solid rgba(201,165,114,.55)' : '1px solid var(--line)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        boxShadow: isNew ? '0 0 0 4px rgba(201,165,114,.14)' : 'none',
        transition: 'box-shadow .3s',
      }}
      onClick={() => isNew && onView && onView(appt.id)}
    >
      {isNew && (
        <div style={{ position: 'absolute', top: 12, right: 12, color: 'var(--gold)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nouveau</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingRight: isNew ? 74 : 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: 'var(--gold)' }}>
            {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: 0, lineHeight: 1.05 }}>
            {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>{appt.duration} min</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={'pill ' + appt.status}>
            {appt.status === 'confirmed' ? 'Confirmé' : appt.status === 'pending' ? 'En attente' : appt.status === 'completed' ? 'Terminé' : 'Annulé'}
          </span>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--gold)', marginTop: 8 }}>{money(appt.total)}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{appt.client_name}</div>
        <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>{svc?.name || 'Soin Face Signature'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 4, lineHeight: 1.45 }}>{appt.client_phone} · {appt.client_email}</div>
        {appt.notes && (
          <div style={{ fontSize: 12.5, color: 'var(--cream-soft)', marginTop: 8, padding: '9px 10px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--line)' }}>{appt.notes}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: appt.status === 'pending' ? '1fr 1fr' : '1fr', gap: 8 }}>
        {appt.status === 'pending' && (
          <button type="button" className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); onConfirm(appt.id); }}>
            <Icon n="check" s={14} /> Confirmer
          </button>
        )}
        {appt.status === 'confirmed' && isPast && (
          <button type="button" className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); onComplete(appt.id); }}>
            <Icon n="check" s={14} /> Marquer terminé
          </button>
        )}
        {appt.status !== 'cancelled' && appt.status !== 'completed' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); if (window.confirm('Annuler ce rendez-vous ?')) onCancel(appt.id); }}>
            <Icon n="close" s={14} /> Annuler
          </button>
        )}
      </div>

      {appt.status !== 'cancelled' && appt.status !== 'completed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <a className="btn btn-ghost btn-sm" href={`tel:${appt.client_phone}`} onClick={e => e.stopPropagation()}><Icon n="phone" s={14} /> Appeler</a>
          <a className="btn btn-ghost btn-sm" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><Icon n="wa" s={14} /> WhatsApp</a>
          <a className="btn btn-ghost btn-sm" href={`mailto:${appt.client_email}`} onClick={e => e.stopPropagation()}><Icon n="mail" s={14} /> Email</a>
        </div>
      )}
    </article>
  );
}

function TabToday({ bookings, services, onConfirm, onCancel, onComplete, onView }: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = bookings
    .filter((a: any) => new Date(a.appointment_at).toDateString() === new Date().toDateString())
    .sort((a: any, b: any) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime());
  const newOnes = bookings.filter((a: any) => a.is_new && a.status === 'pending');

  const monthRev = bookings
    .filter((a: any) => {
      const d = new Date(a.appointment_at);
      return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear() && a.status !== 'cancelled';
    })
    .reduce((s: number, a: any) => s + (a.total || 0), 0);

  const weekCount = bookings.filter((a: any) => {
    const d = new Date(a.appointment_at);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7 && a.status !== 'cancelled';
  }).length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="CA du mois" value={money(monthRev)} />
        <Kpi label="Aujourd'hui" value={todays.length} sub="RDV" />
        <Kpi label="Cette semaine" value={weekCount} sub="à venir" />
        <Kpi label="Prestations" value={services.length} sub="actives" />
      </div>

      {newOnes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(201,165,114,.12)', border: '1px solid rgba(201,165,114,.35)', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)' }}>{newOnes.length} nouvelle{newOnes.length > 1 ? 's' : ''} réservation{newOnes.length > 1 ? 's' : ''} à confirmer</div>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 3 }}>Traitez-les en priorité depuis les cartes ci-dessous.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {newOnes.map((a: any) => <ApptCard key={a.id} appt={a} isNew onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} onView={onView} />)}
          </div>
        </section>
      )}

      <SectionTitle title="Aujourd'hui" sub={`${todays.length} rendez-vous`} />
      {todays.length === 0 ? (
        <Empty icon="calendar" title="Aucun rendez-vous aujourd'hui" sub="Les nouvelles demandes apparaîtront ici en temps réel." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todays.map((a: any) => <ApptCard key={a.id} appt={a} onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} />)}
        </div>
      )}
    </>
  );
}

function TabAppointments({ bookings, onConfirm, onCancel, onComplete }: any) {
  const [filter, setFilter] = useState<'upcoming' | 'pending' | 'confirmed' | 'past' | 'all'>('upcoming');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let list = bookings;
  if (filter === 'upcoming') list = bookings.filter((a: any) => new Date(a.appointment_at) >= today && a.status !== 'cancelled');
  else if (filter === 'pending') list = bookings.filter((a: any) => a.status === 'pending');
  else if (filter === 'confirmed') list = bookings.filter((a: any) => a.status === 'confirmed');
  else if (filter === 'past') list = bookings.filter((a: any) => new Date(a.appointment_at) < today);

  list = [...list].sort((a: any, b: any) =>
    filter === 'past'
      ? new Date(b.appointment_at).getTime() - new Date(a.appointment_at).getTime()
      : new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
  );

  const exportCSV = () => {
    const rows = [['Date', 'Heure', 'Cliente', 'Téléphone', 'Email', 'Soin', 'Statut', 'Total']];
    bookings.forEach((a: any) => {
      const d = new Date(a.appointment_at);
      rows.push([
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        a.client_name, a.client_phone || '', a.client_email || '',
        a.services?.name || '', a.status, money(a.total),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'face-signature-rdv.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { k: 'upcoming', l: 'À venir' },
          { k: 'pending', l: 'En attente' },
          { k: 'confirmed', l: 'Confirmés' },
          { k: 'past', l: 'Passés' },
          { k: 'all', l: 'Tous' },
        ].map(f => (
          <button key={f.k} type="button" className={'btn btn-sm ' + (filter === f.k ? 'btn-primary' : 'btn-ghost')} onClick={() => setFilter(f.k as any)} style={{ flexShrink: 0 }}>{f.l}</button>
        ))}
      </div>

      <SectionTitle title="Rendez-vous" sub={`${list.length} affiché${list.length > 1 ? 's' : ''}`}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCSV}><Icon n="download" s={13} /> Exporter</button>
      </SectionTitle>

      {list.length === 0 ? (
        <Empty icon="calendar" title="Aucun rendez-vous" sub="Changez de filtre ou attendez une nouvelle réservation." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((a: any) => <ApptCard key={a.id} appt={a} onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} />)}
        </div>
      )}
    </>
  );
}

function TabClients({ bookings }: any) {
  const map: Record<string, any> = {};
  bookings.forEach((a: any) => {
    const key = (a.client_email || a.client_phone || a.client_name || '').toLowerCase();
    if (!map[key]) {
      map[key] = { name: a.client_name, phone: a.client_phone, email: a.client_email, visits: 0, total: 0, last: a.appointment_at };
    }
    if (a.status !== 'cancelled') { map[key].visits++; map[key].total += a.total || 0; }
    if (new Date(a.appointment_at) > new Date(map[key].last)) map[key].last = a.appointment_at;
  });
  const clients = Object.values(map).sort((a: any, b: any) => b.total - a.total);

  return (
    <>
      <SectionTitle title="Clientes" sub={`${clients.length} fiche${clients.length > 1 ? 's' : ''}`} />
      {clients.length === 0 ? (
        <Empty icon="users" title="Aucune cliente" sub="Les fiches s'ajoutent automatiquement après les réservations." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c: any, i: number) => (
            <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)' }}>{c.visits} visite{c.visits > 1 ? 's' : ''} · {c.email}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 2 }}>{c.phone}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {c.total > 300 ? <span className="pill confirmed">VIP</span> : c.visits > 2 ? <span className="pill pending">Fidèle</span> : null}
                  <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--gold)', marginTop: 8 }}>{money(c.total)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <a className="btn btn-ghost btn-sm" href={`tel:${c.phone}`}><Icon n="phone" s={14} /> Appeler</a>
                <a className="btn btn-ghost btn-sm" href={`https://wa.me/${whatsappPhone(c.phone || '')}`} target="_blank" rel="noreferrer"><Icon n="wa" s={14} /> WhatsApp</a>
                <a className="btn btn-ghost btn-sm" href={`mailto:${c.email}`}><Icon n="mail" s={14} /> Email</a>
              </div>
              <div style={{ fontSize: 12, color: 'var(--mute)' }}>
                Dernière visite : {new Date(c.last).toLocaleDateString('fr-FR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TabSettings({ user }: any) {
  return (
    <>
      <SectionTitle title="Réglages" />

      <Card label="Compte">
        <Row label="Email" value={user.email} />
        <Row label="Dernière connexion" value={new Date(user.last_sign_in_at || Date.now()).toLocaleString('fr-FR')} />
      </Card>

      <Card label="Institut">
        <Row label="Nom" value="Face Signature" />
        <Row label="Adresse" value="152 Rue de Charenton, 75012 Paris" />
        <Row label="Téléphone" value="+33 6 95 24 18 07" />
      </Card>

      <Card label="Horaires">
        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
          <Row key={d} label={d} value={d === 'Dimanche' ? 'Sur RDV' : '10:00 - 19:00'} />
        ))}
      </Card>

      <Card label="Fonctionnement">
        <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.65 }}>
          Les nouveaux rendez-vous arrivent en temps réel quand cette page est ouverte. Les emails de réservation sont envoyés automatiquement, et chaque carte permet de confirmer, annuler, appeler, contacter par WhatsApp ou marquer terminé.
        </div>
      </Card>
    </>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 6, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 300, color: 'var(--gold)', letterSpacing: 0, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, sub, children }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{title}</h2>
      {sub && <span style={{ fontSize: 12, color: 'var(--mute)' }}>{sub}</span>}
      {children}
    </div>
  );
}

function Empty({ icon, title, sub }: any) {
  return (
    <div style={{ padding: '46px 20px', textAlign: 'center', background: 'var(--bg-2)', border: '1px dashed var(--line-2)', borderRadius: 14, color: 'var(--mute)' }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--bg-3)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
        <Icon n={icon} s={22} />
      </div>
      <div style={{ color: 'var(--cream)', fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function Card({ label, children }: any) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ color: 'var(--mute)', fontSize: 13, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
