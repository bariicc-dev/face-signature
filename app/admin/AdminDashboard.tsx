'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/Icon';
import { createClient } from '@/lib/supabase-browser';

type Booking = any;

export function AdminDashboard({ user, initialBookings, services }: { user: any; initialBookings: Booking[]; services: any[] }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [tab, setTab] = useState<'today' | 'appts' | 'clients' | 'settings'>('today');
  const [toast, setToast] = useState<string | null>(null);
  const sb = createClient();

  // Realtime subscription: new bookings arrive while she's logged in
  useEffect(() => {
    const channel = sb
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, async (payload) => {
        // Refetch all (simpler than diffing)
        const { data } = await sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false });
        if (data) setBookings(data);
        if (payload.eventType === 'INSERT') {
          setToast('✨ Nouvelle réservation reçue !');
          setTimeout(() => setToast(null), 4000);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  const newCount = bookings.filter(b => b.is_new && b.status === 'pending').length;

  const updateBooking = async (id: string, fields: any) => {
    const { error } = await sb.from('bookings').update(fields).eq('id', id);
    if (error) { setToast('Erreur'); return; }
    setBookings(b => b.map(x => x.id === id ? { ...x, ...fields } : x));
  };

  const markRead = (id: string) => updateBooking(id, { is_new: false });
  const confirm = (id: string) => { updateBooking(id, { status: 'confirmed', is_new: false }); setToast('Confirmé'); setTimeout(() => setToast(null), 2500); };
  const cancel = (id: string) => { updateBooking(id, { status: 'cancelled', is_new: false }); setToast('Annulé'); setTimeout(() => setToast(null), 2500); };
  const complete = (id: string) => { updateBooking(id, { status: 'completed' }); setToast('Marqué terminé'); setTimeout(() => setToast(null), 2500); };

  const signout = async () => {
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 90 }}>
      <header style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(20px)' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>Bonjour 👋</div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-.01em', marginTop: 2 }}>
            Face Signature
            {newCount > 0 && (
              <span style={{ background: 'var(--gold)', color: 'var(--ink)', fontSize: 10.5, padding: '3px 8px', borderRadius: 999, fontWeight: 600, marginLeft: 8, verticalAlign: 'middle' }}>
                {newCount} nouveau{newCount > 1 ? 'x' : ''}
              </span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={signout} title="Déconnexion"><Icon n="logout" s={15} /></button>
      </header>

      <div style={{ padding: '18px 20px', maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'today' && <TabToday bookings={bookings} services={services} onConfirm={confirm} onCancel={cancel} onComplete={complete} onView={markRead} />}
        {tab === 'appts' && <TabAppointments bookings={bookings} onConfirm={confirm} onCancel={cancel} onComplete={complete} />}
        {tab === 'clients' && <TabClients bookings={bookings} />}
        {tab === 'settings' && <TabSettings user={user} />}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, background: 'var(--bg-2)', borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '8px 8px env(safe-area-inset-bottom)', backdropFilter: 'blur(20px)' }}>
        {[
          { k: 'today', l: "Aujourd'hui", i: 'dash', badge: newCount },
          { k: 'appts', l: 'RDV', i: 'calendar' },
          { k: 'clients', l: 'Clientes', i: 'users' },
          { k: 'settings', l: 'Réglages', i: 'settings' },
        ].map(t => (
          <a key={t.k} onClick={() => setTab(t.k as any)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', fontSize: 10.5, color: tab === t.k ? 'var(--gold)' : 'var(--mute)', cursor: 'pointer', borderRadius: 10, position: 'relative' }}>
            {tab === t.k && <span style={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2, background: 'var(--gold)', borderRadius: '0 0 4px 4px' }} />}
            <Icon n={t.i} s={20} />
            {t.l}
            {!!t.badge && t.badge > 0 && (
              <span style={{ position: 'absolute', top: 4, right: '25%', background: 'var(--gold)', color: 'var(--ink)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{t.badge}</span>
            )}
          </a>
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

function CalendarBadge({ status, link }: { status?: string | null; link?: string | null }) {
  if (status === 'synced') {
    const badge = <span className="pill confirmed">Agenda OK</span>;
    return link ? <a href={link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{badge}</a> : badge;
  }

  if (status === 'error') {
    return <span className="pill cancelled">Agenda erreur</span>;
  }

  return <span className="pill pending">Agenda non configuré</span>;
}

function ApptCard({ appt, isNew, onConfirm, onCancel, onComplete, onView }: any) {
  const svc = appt.services;
  const d = new Date(appt.appointment_at);
  const phone = (appt.client_phone || '').replace(/\D/g, '');
  return (
    <div
      style={{
        background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
        boxShadow: isNew ? '0 0 0 4px rgba(201,165,114,.2)' : 'none', transition: 'box-shadow .3s',
      }}
      onClick={() => isNew && onView && onView(appt.id)}
    >
      {isNew && (
        <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', animation: 'newpulse 2s infinite' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: 'var(--gold)' }}>
            {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-.02em', lineHeight: 1.1 }}>
            {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>{appt.duration} min</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
          <span className={'pill ' + appt.status}>
            {appt.status === 'confirmed' ? 'Confirmé' : appt.status === 'pending' ? 'En attente' : appt.status === 'completed' ? 'Terminé' : 'Annulé'}
          </span>
          <CalendarBadge status={appt.calendar_sync_status} link={appt.google_event_link} />
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--gold)', letterSpacing: '-.01em' }}>{appt.total}€</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{appt.client_name}</div>
        <div style={{ fontSize: 13, color: 'var(--mute)' }}>{svc?.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 2 }}>📞 {appt.client_phone} · ✉️ {appt.client_email}</div>
        {appt.notes && (
          <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8 }}>💬 {appt.notes}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        {appt.status === 'pending' && (
          <button className="btn btn-gold" style={{ flex: 1, minWidth: 90, justifyContent: 'center', padding: '10px 14px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); onConfirm(appt.id); }}>
            <Icon n="check" s={14} /> Confirmer
          </button>
        )}
        {appt.status === 'confirmed' && new Date(appt.appointment_at) < new Date() && (
          <button className="btn btn-ghost" style={{ flex: 1, minWidth: 90, justifyContent: 'center', padding: '10px 14px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); onComplete(appt.id); }}>
            <Icon n="check" s={14} /> Terminé
          </button>
        )}
        {appt.status !== 'cancelled' && appt.status !== 'completed' && (
          <>
            <a className="icon-btn" href={`tel:${appt.client_phone}`} onClick={e => e.stopPropagation()}><Icon n="phone" s={15} /></a>
            <a className="icon-btn" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#25D366' }}><Icon n="wa" s={15} /></a>
            <a className="icon-btn" href={`mailto:${appt.client_email}`} onClick={e => e.stopPropagation()}><Icon n="mail" s={15} /></a>
            {appt.google_event_link && <a className="icon-btn" href={appt.google_event_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Ouvrir dans Google Calendar"><Icon n="calendar" s={15} /></a>}
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); if (confirm('Annuler ce rendez-vous ?')) onCancel(appt.id); }}><Icon n="close" s={15} /></button>
          </>
        )}
      </div>
    </div>
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
    .reduce((s: number, a: any) => s + a.total, 0);

  const weekCount = bookings.filter((a: any) => {
    const d = new Date(a.appointment_at);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7 && a.status !== 'cancelled';
  }).length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 22 }}>
        <Kpi label="CA du mois" value={`${monthRev}€`} />
        <Kpi label="Aujourd'hui" value={todays.length} sub="RDV" />
        <Kpi label="Cette semaine" value={weekCount} sub="à venir" />
        <Kpi label="Total RDV" value={bookings.length} sub="toutes périodes" />
      </div>

      {newOnes.length > 0 && (
        <>
          <SectionTitle title="✨ Nouvelles réservations" sub={`${newOnes.length} à confirmer`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {newOnes.map((a: any) => <ApptCard key={a.id} appt={a} isNew onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} onView={onView} />)}
          </div>
        </>
      )}

      <SectionTitle title="Aujourd'hui" sub={`${todays.length} rendez-vous`} />
      {todays.length === 0 ? (
        <Empty icon="calendar" title="Aucun rendez-vous aujourd'hui" sub="Profitez du calme ✿" />
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
    const rows = [['Date', 'Heure', 'Cliente', 'Téléphone', 'Email', 'Soin', 'Statut', 'Agenda', 'Total']];
    bookings.forEach((a: any) => {
      const d = new Date(a.appointment_at);
      rows.push([
        d.toLocaleDateString('fr-FR'),
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        a.client_name, a.client_phone || '', a.client_email || '',
        a.services?.name || '', a.status, a.calendar_sync_status || '', a.total + '€',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'face-signature-rdv.csv'; a.click();
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
          <button key={f.k} className={'btn btn-sm ' + (filter === f.k ? 'btn-primary' : 'btn-ghost')} onClick={() => setFilter(f.k as any)} style={{ flexShrink: 0 }}>{f.l}</button>
        ))}
      </div>

      <SectionTitle title="Rendez-vous">
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Icon n="download" s={13} /> Exporter</button>
      </SectionTitle>

      {list.length === 0 ? (
        <Empty icon="calendar" title="Aucun rendez-vous" sub="Rien à afficher dans cette catégorie" />
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
    if (!map[a.client_name]) {
      map[a.client_name] = { name: a.client_name, phone: a.client_phone, email: a.client_email, visits: 0, total: 0, last: a.appointment_at };
    }
    if (a.status !== 'cancelled') { map[a.client_name].visits++; map[a.client_name].total += a.total; }
    if (new Date(a.appointment_at) > new Date(map[a.client_name].last)) map[a.client_name].last = a.appointment_at;
  });
  const clients = Object.values(map).sort((a: any, b: any) => b.total - a.total);

  return (
    <>
      <SectionTitle title="Clientes" sub={`${clients.length} fiches`} />
      {clients.length === 0 ? (
        <Empty icon="users" title="Aucune cliente" sub="Les fiches s'ajoutent automatiquement" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c: any, i: number) => (
            <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)' }}>{c.visits} visite{c.visits > 1 ? 's' : ''} · {c.email}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 2 }}>📞 {c.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {c.total > 300 ? <span className="pill confirmed">VIP</span> : c.visits > 2 ? <span className="pill pending">Fidèle</span> : null}
                  <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--gold)', marginTop: 8 }}>{c.total}€</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <a className="icon-btn" href={`tel:${c.phone}`}><Icon n="phone" s={15} /></a>
                <a className="icon-btn" href={`https://wa.me/${(c.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}><Icon n="wa" s={15} /></a>
                <a className="icon-btn" href={`mailto:${c.email}`}><Icon n="mail" s={15} /></a>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--mute)', alignSelf: 'center' }}>
                  Dernière : {new Date(c.last).toLocaleDateString('fr-FR')}
                </div>
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
        <Row label="Adresse" value="152 Rue de Charenton" />
        <Row label="Téléphone" value="+33 6 95 24 18 07" />
      </Card>

      <Card label="Horaires">
        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
          <Row key={d} label={d} value={d === 'Dimanche' ? 'Sur RDV' : '10:00 — 19:00'} />
        ))}
      </Card>

      <Card label="Agenda Google">
        <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.6 }}>
          Les nouvelles réservations sont enregistrées dans Supabase puis copiées dans l'agenda Google configuré côté serveur. Si le badge indique "Agenda erreur", le RDV reste bien présent ici et les logs Vercel donnent le détail.
        </div>
      </Card>

      <Card label="Astuces">
        <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.6 }}>
          📱 <b style={{ color: 'var(--cream)' }}>Installer sur le téléphone :</b> Ouvrez ce site sur Safari (iPhone), appuyez sur "Partager" puis "Sur l'écran d'accueil". L'admin se comportera comme une vraie app.<br /><br />
          📧 Tous les nouveaux RDV vous sont envoyés par email automatiquement.<br /><br />
          🔔 Quand vous êtes connectée, les nouvelles réservations apparaissent en temps réel.
        </div>
      </Card>
    </>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 6, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 300, color: 'var(--gold)', letterSpacing: '-.02em', lineHeight: 1 }}>{value}</div>
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
    <div style={{ padding: '50px 20px', textAlign: 'center', background: 'var(--bg-2)', border: '1px dashed var(--line-2)', borderRadius: 14, color: 'var(--mute)' }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--bg-3)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
        <Icon n={icon} s={22} />
      </div>
      <div style={{ color: 'var(--cream)', fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div>{sub}</div>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ color: 'var(--mute)', fontSize: 13 }}>{value}</span>
    </div>
  );
}
