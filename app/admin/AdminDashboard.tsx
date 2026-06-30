'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/Icon';
import { createClient } from '@/lib/supabase-browser';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';
type Tab = 'today' | 'agenda' | 'add' | 'clients' | 'stats';
type AgendaMode = 'day' | 'week' | 'month';

type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
};

type Booking = {
  id: string;
  service_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  appointment_at: string;
  duration: number;
  total: number;
  notes?: string | null;
  status: Status;
  is_new?: boolean;
  google_event_link?: string | null;
  calendar_sync_status?: string | null;
  services?: Service | null;
};

type ManualForm = {
  clientName: string;
  phone: string;
  email: string;
  serviceId: string;
  date: string;
  time: string;
  notes: string;
  status: Status;
  total: string;
  duration: string;
  sendClientEmail: boolean;
};

const statusLabel: Record<Status, string> = {
  pending: 'A confirmer',
  confirmed: 'Confirme',
  completed: 'Termine',
  cancelled: 'Annule',
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(date: string | Date) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function money(value: number) {
  return `${Math.round(value || 0)}€`;
}

function normalizePhone(value: string) {
  return (value || '').replace(/\D/g, '');
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function sortByDate(list: Booking[], asc = true) {
  return [...list].sort((a, b) => {
    const diff = new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime();
    return asc ? diff : -diff;
  });
}

function buildInitialForm(services: Service[]): ManualForm {
  const service = services[0];
  return {
    clientName: '',
    phone: '',
    email: '',
    serviceId: service?.id || '',
    date: toInputDate(new Date()),
    time: '10:00',
    notes: '',
    status: 'confirmed',
    total: service ? String(service.price) : '',
    duration: service ? String(service.duration) : '',
    sendClientEmail: false,
  };
}

function deriveClients(bookings: Booking[]) {
  const clients: Record<string, any> = {};

  bookings.forEach((booking) => {
    const phoneKey = normalizePhone(booking.client_phone);
    const emailKey = (booking.client_email || '').trim().toLowerCase();
    const key = phoneKey || emailKey || booking.client_name.trim().toLowerCase();
    if (!key) return;

    if (!clients[key]) {
      clients[key] = {
        name: booking.client_name,
        phone: booking.client_phone,
        email: booking.client_email,
        visits: 0,
        total: 0,
        last: booking.appointment_at,
      };
    }

    if (booking.status !== 'cancelled') {
      clients[key].visits += 1;
      clients[key].total += Number(booking.total || 0);
    }

    if (new Date(booking.appointment_at) > new Date(clients[key].last)) {
      clients[key].last = booking.appointment_at;
      clients[key].name = booking.client_name;
      clients[key].phone = booking.client_phone;
      clients[key].email = booking.client_email;
    }
  });

  return Object.values(clients).sort((a: any, b: any) => new Date(b.last).getTime() - new Date(a.last).getTime());
}

export function AdminDashboard({ user, initialBookings, services }: { user: any; initialBookings: Booking[]; services: Service[] }) {
  const router = useRouter();
  const sb = createClient();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  useEffect(() => {
    const channel = sb
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, async () => {
        const { data } = await sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false });
        if (data) setBookings(data as Booking[]);
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, []);

  const today = startOfDay(new Date());
  const todayBookings = sortByDate(bookings.filter((booking) => sameDay(new Date(booking.appointment_at), today)));
  const upcomingToday = todayBookings.filter((booking) => booking.status !== 'cancelled' && booking.status !== 'completed');
  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;
  const clients = useMemo(() => deriveClients(bookings), [bookings]);

  const currentMonthStats = useMemo(() => getMonthStats(bookings, new Date()), [bookings]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const updateBooking = async (id: string, fields: Partial<Booking>) => {
    const { error } = await sb.from('bookings').update(fields).eq('id', id);
    if (error) {
      showToast('Action impossible');
      return;
    }
    setBookings((items) => items.map((item) => item.id === id ? { ...item, ...fields } : item));
    setSelected((item) => item && item.id === id ? { ...item, ...fields } : item);
  };

  const signout = async () => {
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 92, background: 'var(--bg)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(15,13,12,.92)', borderBottom: '1px solid var(--line)', backdropFilter: 'blur(18px)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <Logo />
            <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 4 }}>
              {upcomingToday.length} RDV aujourd'hui
              {pendingCount > 0 ? ` · ${pendingCount} a confirmer` : ''}
            </div>
          </div>
          <button className="icon-btn" onClick={signout} title="Deconnexion"><Icon n="logout" s={15} /></button>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '16px' }}>
        {tab === 'today' && (
          <TodayTab
            bookings={todayBookings}
            stats={currentMonthStats}
            pendingCount={pendingCount}
            onSelect={setSelected}
            onConfirm={(id) => updateBooking(id, { status: 'confirmed', is_new: false })}
            onCancel={(id) => updateBooking(id, { status: 'cancelled', is_new: false })}
            onComplete={(id) => updateBooking(id, { status: 'completed', is_new: false })}
            onGoAgenda={() => setTab('agenda')}
            onGoAdd={() => setTab('add')}
          />
        )}
        {tab === 'agenda' && (
          <AgendaTab
            bookings={bookings}
            onSelect={setSelected}
            onConfirm={(id) => updateBooking(id, { status: 'confirmed', is_new: false })}
            onCancel={(id) => updateBooking(id, { status: 'cancelled', is_new: false })}
            onComplete={(id) => updateBooking(id, { status: 'completed', is_new: false })}
          />
        )}
        {tab === 'add' && (
          <AddBookingTab
            services={services}
            clients={clients}
            onCreated={(booking) => {
              setBookings((items) => [booking, ...items]);
              showToast('RDV ajoute');
              setTab('agenda');
            }}
          />
        )}
        {tab === 'clients' && <ClientsTab clients={clients} />}
        {tab === 'stats' && <StatsTab bookings={bookings} />}
      </main>

      <BottomNav tab={tab} pendingCount={pendingCount} onChange={setTab} />

      {selected && (
        <BookingSheet
          booking={selected}
          onClose={() => setSelected(null)}
          onConfirm={(id) => updateBooking(id, { status: 'confirmed', is_new: false })}
          onCancel={(id) => updateBooking(id, { status: 'cancelled', is_new: false })}
          onComplete={(id) => updateBooking(id, { status: 'completed', is_new: false })}
        />
      )}

      {toast && (
        <div className="toast-wrap">
          <div className="toast in"><div className="ic"><Icon n="check" s={14} /></div><span>{toast}</span></div>
        </div>
      )}
    </div>
  );
}

function BottomNav({ tab, pendingCount, onChange }: { tab: Tab; pendingCount: number; onChange: (tab: Tab) => void }) {
  const items: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: 'today', label: "Aujourd'hui", icon: 'dash', badge: pendingCount },
    { key: 'agenda', label: 'Agenda', icon: 'calendar' },
    { key: 'add', label: 'Ajouter', icon: 'plus' },
    { key: 'clients', label: 'Clients', icon: 'users' },
    { key: 'stats', label: 'Stats', icon: 'chart' },
  ];

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'rgba(23,20,19,.96)', borderTop: '1px solid var(--line)', backdropFilter: 'blur(18px)', padding: '7px 6px env(safe-area-inset-bottom)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
        {items.map((item) => (
          <button key={item.key} onClick={() => onChange(item.key)} style={{ position: 'relative', minHeight: 54, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: tab === item.key ? 'var(--gold)' : 'var(--mute)', background: tab === item.key ? 'rgba(201,165,114,.08)' : 'transparent', fontSize: 10.5, fontWeight: 500 }}>
            <Icon n={item.icon} s={19} />
            {item.label}
            {!!item.badge && item.badge > 0 && (
              <span style={{ position: 'absolute', top: 5, right: '24%', background: 'var(--gold)', color: 'var(--ink)', borderRadius: 999, minWidth: 16, height: 16, padding: '0 5px', fontSize: 9, lineHeight: '16px', fontWeight: 700 }}>{item.badge}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

function TodayTab({ bookings, stats, pendingCount, onSelect, onConfirm, onCancel, onComplete, onGoAgenda, onGoAdd }: any) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Kpi label="CA realise" value={money(stats.realized)} sub="ce mois" />
        <Kpi label="CA prevu" value={money(stats.planned)} sub="a venir" />
        <Kpi label="Aujourd'hui" value={bookings.length} sub="rendez-vous" />
        <Kpi label="A confirmer" value={pendingCount} sub="nouveaux RDV" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-gold" onClick={onGoAdd} style={{ justifyContent: 'center' }}><Icon n="plus" s={14} /> Ajouter</button>
        <button className="btn btn-ghost" onClick={onGoAgenda} style={{ justifyContent: 'center' }}><Icon n="calendar" s={14} /> Agenda</button>
      </div>

      <SectionTitle title="Aujourd'hui" sub={`${bookings.length} RDV`} />
      {bookings.length === 0 ? (
        <Empty title="Aucun rendez-vous aujourd'hui" sub="L'agenda est calme pour cette journee." icon="calendar" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {bookings.map((booking: Booking) => (
            <BookingCard key={booking.id} booking={booking} onSelect={onSelect} onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaTab({ bookings, onSelect, onConfirm, onCancel, onComplete }: any) {
  const [mode, setMode] = useState<AgendaMode>('week');
  const [cursor, setCursor] = useState(() => new Date());

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfDay(cursor), end: new Date(startOfDay(cursor).getTime() + 86400000) };
    if (mode === 'month') return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
    return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
  }, [mode, cursor]);

  const list = sortByDate(bookings.filter((booking: Booking) => {
    const date = new Date(booking.appointment_at);
    return date >= range.start && date < range.end;
  }));

  const grouped = groupByDate(list);
  const title = mode === 'day'
    ? formatDay(cursor)
    : mode === 'month'
      ? cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : `${range.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${new Date(range.end.getTime() - 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

  const move = (dir: number) => {
    const next = new Date(cursor);
    if (mode === 'day') next.setDate(next.getDate() + dir);
    if (mode === 'week') next.setDate(next.getDate() + dir * 7);
    if (mode === 'month') next.setMonth(next.getMonth() + dir);
    setCursor(next);
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Segmented
        value={mode}
        onChange={(value: AgendaMode) => setMode(value)}
        options={[
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button className="icon-btn" onClick={() => move(-1)}><Icon n="chevL" s={15} /></button>
        <div style={{ textAlign: 'center', textTransform: 'capitalize', fontSize: 17, fontWeight: 500 }}>{title}</div>
        <button className="icon-btn" onClick={() => move(1)}><Icon n="chev" s={15} /></button>
      </div>

      {list.length === 0 ? (
        <Empty title="Aucun RDV" sub="Rien sur cette periode." icon="calendar" />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {Object.keys(grouped).map((day) => (
            <section key={day}>
              <div style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', marginBottom: 8 }}>{day}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {grouped[day].map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onSelect={onSelect} onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} compact />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBookingTab({ services, clients, onCreated }: { services: Service[]; clients: any[]; onCreated: (booking: Booking) => void }) {
  const [form, setForm] = useState<ManualForm>(() => buildInitialForm(services));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = services.find((service) => service.id === form.serviceId);
  const suggestions = clients
    .filter((client) => {
      const haystack = `${client.name} ${client.phone} ${client.email}`.toLowerCase();
      return query.trim().length >= 2 && haystack.includes(query.toLowerCase());
    })
    .slice(0, 5);

  const updateService = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      total: service ? String(service.price) : current.total,
      duration: service ? String(service.duration) : current.duration,
    }));
  };

  const pickClient = (client: any) => {
    setForm((current) => ({
      ...current,
      clientName: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
    }));
    setQuery('');
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      const appointmentAt = new Date(`${form.date}T${form.time}:00`);
      const response = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: form.serviceId,
          appointmentAt: appointmentAt.toISOString(),
          name: form.clientName,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
          status: form.status,
          total: Number(form.total),
          duration: Number(form.duration),
          sendClientEmail: form.sendClientEmail,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Creation impossible');

      onCreated(json.booking);
      setForm(buildInitialForm(services));
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Creation impossible');
    } finally {
      setSaving(false);
    }
  };

  const isValid = form.clientName.trim() && form.phone.trim() && form.serviceId && form.date && form.time && Number(form.total) > 0 && Number(form.duration) > 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionTitle title="Ajouter un RDV" sub="Pour telephone, DM ou passage direct" />

      <Card>
        <div className="field">
          <label>Rechercher une cliente</label>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, telephone ou email" />
        </div>
        {suggestions.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {suggestions.map((client: any) => (
              <button key={`${client.phone}-${client.email}`} onClick={() => pickClient(client)} style={{ textAlign: 'left', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 500 }}>{client.name}</div>
                <div style={{ color: 'var(--mute)', fontSize: 12 }}>{client.phone || 'Sans telephone'} · {client.email || 'Sans email'}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>Nom cliente</label><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Nom complet" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Telephone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" /></div>
            <div className="field"><label>Email optionnel</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, sendClientEmail: e.target.value ? form.sendClientEmail : false })} placeholder="cliente@email.com" /></div>
          </div>
          <div className="field">
            <label>Soin</label>
            <select className="select" value={form.serviceId} onChange={(e) => updateService(e.target.value)}>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Date</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label>Heure</label><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field"><label>Prix</label><input className="input" type="number" min="0" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></div>
            <div className="field"><label>Duree min</label><input className="input" type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            <div className="field">
              <label>Statut</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                <option value="confirmed">Confirme</option>
                <option value="pending">A confirmer</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Notes</label><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Infos utiles pour le RDV" /></div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: form.email ? 'var(--cream)' : 'var(--mute)', fontSize: 13 }}>
            <input type="checkbox" checked={form.sendClientEmail} disabled={!form.email} onChange={(e) => setForm({ ...form, sendClientEmail: e.target.checked })} />
            Envoyer une confirmation a la cliente
          </label>
        </div>

        <div className="summary">
          <div className="summary-row"><span className="l">Soin</span><span>{selectedService?.name || '-'}</span></div>
          <div className="summary-row"><span className="l">Date</span><span>{form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString('fr-FR') : '-'}</span></div>
          <div className="summary-row"><span className="l">Total</span><span style={{ color: 'var(--gold)' }}>{money(Number(form.total))}</span></div>
        </div>

        {error && <div style={{ marginTop: 12, color: '#e57975', background: 'rgba(244,67,54,.1)', border: '1px solid rgba(244,67,54,.35)', padding: 12, borderRadius: 10, fontSize: 13 }}>{error}</div>}

        <button className="btn btn-gold" onClick={submit} disabled={!isValid || saving} style={{ width: '100%', justifyContent: 'center', marginTop: 14, opacity: isValid && !saving ? 1 : .45 }}>
          <Icon n="check" s={14} /> {saving ? 'Creation...' : 'Creer le RDV'}
        </button>
      </Card>
    </div>
  );
}

function ClientsTab({ clients }: { clients: any[] }) {
  const [query, setQuery] = useState('');
  const list = clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionTitle title="Clients" sub={`${clients.length} fiches`} />
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une cliente" />
      {list.length === 0 ? (
        <Empty title="Aucune cliente" sub="Les clientes viennent des RDV existants." icon="users" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((client: any) => (
            <Card key={`${client.phone}-${client.email}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{client.name}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 13 }}>{client.visits} visite{client.visits > 1 ? 's' : ''} · {money(client.total)}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 3 }}>Dernier RDV: {new Date(client.last).toLocaleDateString('fr-FR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {client.phone && <a className="icon-btn" href={`tel:${client.phone}`}><Icon n="phone" s={14} /></a>}
                  {client.phone && <a className="icon-btn" href={`https://wa.me/${normalizePhone(client.phone)}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}><Icon n="wa" s={14} /></a>}
                  {client.email && <a className="icon-btn" href={`mailto:${client.email}`}><Icon n="mail" s={14} /></a>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({ bookings }: { bookings: Booking[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const stats = getMonthStats(bookings, month);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon n="chevL" s={15} /></button>
        <div style={{ textTransform: 'capitalize', fontSize: 18, fontWeight: 500 }}>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon n="chev" s={15} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Kpi label="CA realise" value={money(stats.realized)} sub="termines + confirmes passes" />
        <Kpi label="CA prevu" value={money(stats.planned)} sub="a venir hors annules" />
        <Kpi label="RDV mois" value={stats.count} sub="hors annules" />
        <Kpi label="Ticket moyen" value={money(stats.averageTicket)} sub="CA realise" />
      </div>

      <Card>
        <Row label="RDV termines" value={stats.completed} />
        <Row label="RDV annules" value={stats.cancelled} />
        <Row label="RDV a confirmer" value={stats.pending} />
        <Row label="RDV confirmes" value={stats.confirmed} />
      </Card>
    </div>
  );
}

function getMonthStats(bookings: Booking[], monthDate: Date) {
  const now = new Date();
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const monthBookings = bookings.filter((booking) => {
    const date = new Date(booking.appointment_at);
    return date >= start && date < end;
  });

  const realizedBookings = monthBookings.filter((booking) => {
    const date = new Date(booking.appointment_at);
    return booking.status === 'completed' || (booking.status === 'confirmed' && date < now);
  });
  const plannedBookings = monthBookings.filter((booking) => {
    const date = new Date(booking.appointment_at);
    return booking.status !== 'cancelled' && date >= now && ['pending', 'confirmed'].includes(booking.status);
  });
  const activeBookings = monthBookings.filter((booking) => booking.status !== 'cancelled');
  const realized = realizedBookings.reduce((sum, booking) => sum + Number(booking.total || 0), 0);

  return {
    realized,
    planned: plannedBookings.reduce((sum, booking) => sum + Number(booking.total || 0), 0),
    count: activeBookings.length,
    completed: monthBookings.filter((booking) => booking.status === 'completed').length,
    cancelled: monthBookings.filter((booking) => booking.status === 'cancelled').length,
    pending: monthBookings.filter((booking) => booking.status === 'pending').length,
    confirmed: monthBookings.filter((booking) => booking.status === 'confirmed').length,
    averageTicket: realizedBookings.length ? realized / realizedBookings.length : 0,
  };
}

function BookingCard({ booking, onSelect, onConfirm, onCancel, onComplete, compact = false }: any) {
  const date = new Date(booking.appointment_at);
  const phone = normalizePhone(booking.client_phone);
  const isPast = date < new Date();

  return (
    <article onClick={() => onSelect(booking)} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderLeft: `4px solid ${statusColor(booking.status)}`, borderRadius: 12, padding: compact ? 12 : 14, display: 'grid', gap: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>{formatTime(date)} · {booking.duration} min</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginTop: 2 }}>{booking.client_name}</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.services?.name || 'Soin'}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'grid', justifyItems: 'end', gap: 6 }}>
          <span className={`pill ${booking.status}`}>{statusLabel[booking.status]}</span>
          <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{money(booking.total)}</div>
        </div>
      </div>

      {booking.notes && <div style={{ color: 'var(--mute)', fontSize: 12, background: 'var(--bg-3)', borderRadius: 8, padding: '8px 10px' }}>{booking.notes}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10, flexWrap: 'wrap' }}>
        {booking.status === 'pending' && <button className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); }}><Icon n="check" s={13} /> Confirmer</button>}
        {booking.status === 'confirmed' && isPast && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onComplete(booking.id); }}><Icon n="check" s={13} /> Termine</button>}
        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <>
            <a className="icon-btn" href={`tel:${booking.client_phone}`} onClick={(e) => e.stopPropagation()}><Icon n="phone" s={14} /></a>
            {phone && <a className="icon-btn" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#25D366' }}><Icon n="wa" s={14} /></a>}
            {booking.client_email && <a className="icon-btn" href={`mailto:${booking.client_email}`} onClick={(e) => e.stopPropagation()}><Icon n="mail" s={14} /></a>}
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); if (confirm('Annuler ce rendez-vous ?')) onCancel(booking.id); }}><Icon n="close" s={14} /></button>
          </>
        )}
      </div>
    </article>
  );
}

function BookingSheet({ booking, onClose, onConfirm, onCancel, onComplete }: any) {
  const phone = normalizePhone(booking.client_phone);
  const date = new Date(booking.appointment_at);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '18px 18px 0 0', padding: 18, display: 'grid', gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--gold)', textTransform: 'capitalize', fontSize: 13 }}>{formatDay(date)} · {formatTime(date)}</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 500 }}>{booking.client_name}</h2>
            <div style={{ color: 'var(--mute)', fontSize: 13 }}>{booking.services?.name} · {money(booking.total)}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon n="close" s={15} /></button>
        </div>

        <Card>
          <Row label="Statut" value={statusLabel[booking.status as Status]} />
          <Row label="Telephone" value={booking.client_phone || '-'} />
          <Row label="Email" value={booking.client_email || '-'} />
          <Row label="Duree" value={`${booking.duration} min`} />
          {booking.notes && <Row label="Notes" value={booking.notes} />}
        </Card>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {booking.status === 'pending' && <button className="btn btn-gold" onClick={() => onConfirm(booking.id)}><Icon n="check" s={14} /> Confirmer</button>}
          {booking.status !== 'completed' && booking.status !== 'cancelled' && <button className="btn btn-ghost" onClick={() => onComplete(booking.id)}><Icon n="check" s={14} /> Termine</button>}
          {booking.status !== 'cancelled' && <button className="btn btn-ghost" onClick={() => { if (confirm('Annuler ce rendez-vous ?')) onCancel(booking.id); }}><Icon n="close" s={14} /> Annuler</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <a className="btn btn-ghost" href={`tel:${booking.client_phone}`} style={{ justifyContent: 'center' }}><Icon n="phone" s={14} /> Appel</a>
          <a className="btn btn-ghost" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" style={{ justifyContent: 'center', color: '#25D366' }}><Icon n="wa" s={14} /> WhatsApp</a>
          <a className="btn btn-ghost" href={`mailto:${booking.client_email}`} style={{ justifyContent: 'center', opacity: booking.client_email ? 1 : .45, pointerEvents: booking.client_email ? 'auto' : 'none' }}><Icon n="mail" s={14} /> Email</a>
        </div>
      </div>
    </div>
  );
}

function groupByDate(bookings: Booking[]) {
  return bookings.reduce<Record<string, Booking[]>>((groups, booking) => {
    const label = formatDay(booking.appointment_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(booking);
    return groups;
  }, {});
}

function statusColor(status: Status) {
  if (status === 'confirmed') return '#7fc88a';
  if (status === 'pending') return '#c9a572';
  if (status === 'completed') return '#9b9b9b';
  return '#e57975';
}

function Segmented({ value, onChange, options }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
      {options.map((option: any) => (
        <button key={option.value} onClick={() => onChange(option.value)} style={{ padding: '10px 8px', borderRadius: 9, background: value === option.value ? 'var(--cream)' : 'transparent', color: value === option.value ? 'var(--bg)' : 'var(--mute)', fontSize: 13, fontWeight: 600 }}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
      <div style={{ color: 'var(--mute)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>{label}</div>
      <div style={{ color: 'var(--gold)', fontSize: 25, lineHeight: 1, fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ color: 'var(--mute)', fontSize: 11.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end' }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
      {sub && <span style={{ color: 'var(--mute)', fontSize: 12 }}>{sub}</span>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>{children}</div>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
      <span style={{ color: 'var(--mute)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Empty({ title, sub, icon }: { title: string; sub: string; icon: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px dashed var(--line-2)', borderRadius: 12, padding: '38px 20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--gold)', marginBottom: 10 }}><Icon n={icon} s={25} /></div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
