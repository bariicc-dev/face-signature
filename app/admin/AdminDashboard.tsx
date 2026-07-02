'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/Icon';
import { createClient } from '@/lib/supabase-browser';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';
type Tab = 'today' | 'agenda' | 'add' | 'clients' | 'stats';
type AgendaMode = 'day' | 'week';

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
  services?: Service | null;
};

type Client = {
  key: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  total: number;
  last: string;
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

const DAY_START = 9;
const DAY_END = 20;
const HOUR_HEIGHT = 72;
const statusLabel: Record<Status, string> = {
  pending: 'A confirmer',
  confirmed: 'Confirme',
  completed: 'Termine',
  cancelled: 'Annule',
};
const statusColor: Record<Status, string> = {
  pending: '#d6b36f',
  confirmed: '#79c987',
  completed: '#9da0a6',
  cancelled: '#e57975',
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(date: Date | string) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function money(value: number) {
  return `${Math.round(Number(value || 0))}€`;
}

function normalizePhone(value: string) {
  return (value || '').replace(/\D/g, '');
}

function whatsappPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.startsWith('33')) return digits;
  if (digits.startsWith('0')) return `33${digits.slice(1)}`;
  return digits;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function sortByDate(bookings: Booking[], asc = true) {
  return [...bookings].sort((a, b) => {
    const diff = new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime();
    return asc ? diff : -diff;
  });
}

function initialForm(services: Service[], slot?: { date: string; time: string }): ManualForm {
  const service = services[0];
  return {
    clientName: '',
    phone: '',
    email: '',
    serviceId: service?.id || '',
    date: slot?.date || toInputDate(new Date()),
    time: slot?.time || '10:00',
    notes: '',
    status: 'confirmed',
    total: service ? String(service.price) : '',
    duration: service ? String(service.duration) : '',
    sendClientEmail: false,
  };
}

function deriveClients(bookings: Booking[]) {
  const map: Record<string, Client> = {};
  bookings.forEach((booking) => {
    const phoneKey = normalizePhone(booking.client_phone);
    const emailKey = (booking.client_email || '').trim().toLowerCase();
    const key = phoneKey || emailKey || booking.client_name.trim().toLowerCase();
    if (!key) return;

    if (!map[key]) {
      map[key] = {
        key,
        name: booking.client_name,
        phone: booking.client_phone || '',
        email: booking.client_email || '',
        visits: 0,
        total: 0,
        last: booking.appointment_at,
      };
    }

    if (booking.status !== 'cancelled') {
      map[key].visits += 1;
      map[key].total += Number(booking.total || 0);
    }

    if (new Date(booking.appointment_at) > new Date(map[key].last)) {
      map[key].last = booking.appointment_at;
      map[key].name = booking.client_name;
      map[key].phone = booking.client_phone || '';
      map[key].email = booking.client_email || '';
    }
  });

  return Object.values(map).sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
}

function getMonthStats(bookings: Booking[], month: Date) {
  const now = new Date();
  const start = startOfMonth(month);
  const end = endOfMonth(month);
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
    return date >= now && (booking.status === 'pending' || booking.status === 'confirmed');
  });
  const realized = realizedBookings.reduce((sum, booking) => sum + Number(booking.total || 0), 0);

  return {
    realized,
    planned: plannedBookings.reduce((sum, booking) => sum + Number(booking.total || 0), 0),
    count: monthBookings.filter((booking) => booking.status !== 'cancelled').length,
    completed: monthBookings.filter((booking) => booking.status === 'completed').length,
    cancelled: monthBookings.filter((booking) => booking.status === 'cancelled').length,
    pending: monthBookings.filter((booking) => booking.status === 'pending').length,
    confirmed: monthBookings.filter((booking) => booking.status === 'confirmed').length,
    averageTicket: realizedBookings.length ? realized / realizedBookings.length : 0,
  };
}

function getBookingLayout(booking: Booking) {
  const start = new Date(booking.appointment_at);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const top = Math.max(0, ((minutes - DAY_START * 60) / 60) * HOUR_HEIGHT);
  const height = Math.max(44, (booking.duration / 60) * HOUR_HEIGHT - 6);
  return { top, height };
}

export function AdminDashboard({ user, initialBookings, services }: { user: any; initialBookings: Booking[]; services: Service[] }) {
  const router = useRouter();
  const sb = createClient();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [slot, setSlot] = useState<{ date: string; time: string } | undefined>();

  useEffect(() => {
    const channel = sb
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, async () => {
        const { data } = await sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false });
        if (data) setBookings(data as Booking[]);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  const clients = useMemo(() => deriveClients(bookings), [bookings]);
  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;
  const todayBookings = sortByDate(bookings.filter((booking) => isSameDay(new Date(booking.appointment_at), new Date())));
  const monthStats = useMemo(() => getMonthStats(bookings, new Date()), [bookings]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const patchBooking = async (id: string, fields: Record<string, unknown>) => {
    const response = await fetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    const json = await response.json();
    if (!response.ok) {
      showToast(json.error || 'Action impossible');
      return null;
    }
    setBookings((items) => items.map((item) => item.id === id ? json.booking : item));
    setSelected((item) => item && item.id === id ? json.booking : item);
    return json.booking as Booking;
  };

  const deleteBooking = async (id: string) => {
    const response = await fetch(`/api/admin/bookings?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = await response.json();
    if (!response.ok) {
      showToast(json.error || 'Suppression impossible');
      return;
    }
    setBookings((items) => items.filter((item) => item.id !== id));
    setSelected(null);
    showToast('RDV supprime');
  };

  const signout = async () => {
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const openAddAt = (nextSlot?: { date: string; time: string }) => {
    setSlot(nextSlot);
    setTab('add');
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 94, background: 'linear-gradient(180deg, var(--bg), #141110)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(23,20,19,.95)', borderBottom: '1px solid var(--line)', backdropFilter: 'blur(18px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Logo />
            <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 4 }}>
              {todayBookings.length} RDV aujourd'hui {pendingCount ? `· ${pendingCount} a confirmer` : ''}
            </div>
          </div>
          <button className="icon-btn" onClick={signout} title="Deconnexion" aria-label="Deconnexion"><Icon n="logout" s={15} /></button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: 16 }}>
        {tab === 'today' && (
          <TodayTab
            bookings={todayBookings}
            stats={monthStats}
            pendingCount={pendingCount}
            servicesCount={services.length}
            onSelect={setSelected}
            onConfirm={(id: string) => patchBooking(id, { status: 'confirmed' }).then(() => showToast('RDV confirme'))}
            onCancel={(id: string) => patchBooking(id, { status: 'cancelled' }).then(() => showToast('RDV annule'))}
            onComplete={(id: string) => patchBooking(id, { status: 'completed' }).then(() => showToast('RDV termine'))}
            onAdd={() => openAddAt()}
            onAgenda={() => setTab('agenda')}
          />
        )}
        {tab === 'agenda' && (
          <AgendaTab
            bookings={bookings}
            onSelect={setSelected}
            onAddAt={openAddAt}
          />
        )}
        {tab === 'add' && (
          <AddTab
            services={services}
            clients={clients}
            initialSlot={slot}
            onCreated={(booking) => {
              setBookings((items) => [booking, ...items]);
              setSlot(undefined);
              setTab('agenda');
              showToast('RDV ajoute');
            }}
          />
        )}
        {tab === 'clients' && <ClientsTab clients={clients} />}
        {tab === 'stats' && <StatsTab bookings={bookings} />}
      </main>

      <BottomNav active={tab} pendingCount={pendingCount} onChange={setTab} />

      {selected && (
        <BookingSheet
          booking={selected}
          onClose={() => setSelected(null)}
          onConfirm={(id) => patchBooking(id, { status: 'confirmed' }).then(() => showToast('RDV confirme'))}
          onCancel={(id) => patchBooking(id, { status: 'cancelled' }).then(() => showToast('RDV annule'))}
          onComplete={(id) => patchBooking(id, { status: 'completed' }).then(() => showToast('RDV termine'))}
          onReschedule={(id, appointmentAt, duration) => patchBooking(id, { appointmentAt, duration }).then((booking) => booking && showToast('RDV deplace'))}
          onDelete={deleteBooking}
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

function BottomNav({ active, pendingCount, onChange }: { active: Tab; pendingCount: number; onChange: (tab: Tab) => void }) {
  const items: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: 'today', label: "Aujourd'hui", icon: 'dash', badge: pendingCount },
    { key: 'agenda', label: 'Agenda', icon: 'calendar' },
    { key: 'add', label: 'Ajouter', icon: 'plus' },
    { key: 'clients', label: 'Clients', icon: 'users' },
    { key: 'stats', label: 'Stats', icon: 'chart' },
  ];
  return (
    <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, background: 'rgba(23,20,19,.96)', borderTop: '1px solid var(--line)', backdropFilter: 'blur(18px)', padding: '7px 6px env(safe-area-inset-bottom)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => onChange(item.key)} style={{ minHeight: 54, borderRadius: 12, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, color: active === item.key ? 'var(--gold)' : 'var(--mute)', background: active === item.key ? 'rgba(201,165,114,.08)' : 'transparent', fontSize: 10.5, fontWeight: 600 }}>
            <Icon n={item.icon} s={19} />
            {item.label}
            {!!item.badge && item.badge > 0 && <span style={{ position: 'absolute', top: 5, right: '22%', minWidth: 16, height: 16, padding: '0 5px', borderRadius: 999, background: 'var(--gold)', color: 'var(--ink)', fontSize: 9, lineHeight: '16px' }}>{item.badge}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

function TodayTab({ bookings, stats, pendingCount, servicesCount, onSelect, onConfirm, onCancel, onComplete, onAdd, onAgenda }: any) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Kpi label="CA realise" value={money(stats.realized)} sub="ce mois" />
        <Kpi label="CA prevu" value={money(stats.planned)} sub="a venir" />
        <Kpi label="Aujourd'hui" value={bookings.length} sub="rendez-vous" />
        <Kpi label="A confirmer" value={pendingCount} sub={`${servicesCount} prestations`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-gold" style={{ justifyContent: 'center' }} onClick={onAdd}><Icon n="plus" s={14} /> Ajouter</button>
        <button className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={onAgenda}><Icon n="calendar" s={14} /> Agenda</button>
      </div>
      <SectionTitle title="Aujourd'hui" sub={`${bookings.length} RDV`} />
      {bookings.length === 0 ? <Empty icon="calendar" title="Aucun RDV aujourd'hui" sub="Touchez Ajouter pour creer un RDV telephone ou DM." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {bookings.map((booking: Booking) => <BookingCard key={booking.id} booking={booking} onSelect={onSelect} onConfirm={onConfirm} onCancel={onCancel} onComplete={onComplete} />)}
        </div>
      )}
    </div>
  );
}

function AgendaTab({ bookings, onSelect, onAddAt }: { bookings: Booking[]; onSelect: (booking: Booking) => void; onAddAt: (slot: { date: string; time: string }) => void }) {
  const [mode, setMode] = useState<AgendaMode>('day');
  const [cursor, setCursor] = useState(() => new Date());
  const weekStart = startOfWeek(cursor);
  const days = mode === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthDays = getMonthCells(cursor);

  const title = mode === 'day'
    ? formatDay(cursor)
    : `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${addDays(weekStart, 6).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

  const move = (dir: number) => {
    const next = new Date(cursor);
    next.setDate(next.getDate() + (mode === 'day' ? dir : dir * 7));
    setCursor(next);
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }]} />
      <MonthPicker days={monthDays} cursor={cursor} onPick={setCursor} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button className="icon-btn" onClick={() => move(-1)}><Icon n="chevL" s={15} /></button>
        <div style={{ textAlign: 'center', textTransform: 'capitalize', fontSize: 17, fontWeight: 600 }}>{title}</div>
        <button className="icon-btn" onClick={() => move(1)}><Icon n="chev" s={15} /></button>
      </div>
      <CalendarBoard days={days} bookings={bookings} onSelect={onSelect} onAddAt={onAddAt} />
    </div>
  );
}

function getMonthCells(cursor: Date) {
  const first = startOfMonth(cursor);
  const startOffset = (first.getDay() + 6) % 7;
  const start = addDays(first, -startOffset);
  return Array.from({ length: 35 }, (_, index) => addDays(start, index));
}

function MonthPicker({ days, cursor, onPick }: { days: Date[]; cursor: Date; onPick: (date: Date) => void }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 10 }}>
      <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700, textTransform: 'capitalize', marginBottom: 8 }}>{cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => <div key={`${day}-${i}`} style={{ color: 'var(--mute)', fontSize: 10, textAlign: 'center' }}>{day}</div>)}
        {days.map((day) => {
          const selected = isSameDay(day, cursor);
          const inMonth = day.getMonth() === cursor.getMonth();
          return (
            <button key={day.toISOString()} onClick={() => onPick(day)} style={{ height: 30, borderRadius: 8, background: selected ? 'var(--cream)' : 'transparent', color: selected ? 'var(--bg)' : inMonth ? 'var(--cream)' : 'var(--mute)', opacity: inMonth ? 1 : .42, fontSize: 12 }}>
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarBoard({ days, bookings, onSelect, onAddAt }: { days: Date[]; bookings: Booking[]; onSelect: (booking: Booking) => void; onAddAt: (slot: { date: string; time: string }) => void }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, index) => DAY_START + index);
  return (
    <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
      <div style={{ minWidth: days.length === 1 ? 0 : 760, display: 'grid', gridTemplateColumns: `54px repeat(${days.length}, minmax(150px, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} style={{ padding: '10px 8px', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 3 }}>
            <div style={{ color: isSameDay(day, new Date()) ? 'var(--gold)' : 'var(--cream)', fontWeight: 700, textTransform: 'capitalize', fontSize: 13 }}>
              {day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
        <div style={{ display: 'grid' }}>
          {hours.map((hour) => <div key={hour} style={{ height: HOUR_HEIGHT, color: 'var(--mute)', fontSize: 11, padding: '5px 6px', borderTop: '1px solid var(--line)' }}>{String(hour).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((day) => {
          const dayBookings = bookings.filter((booking) => isSameDay(new Date(booking.appointment_at), day));
          return (
            <div key={day.toISOString()} style={{ position: 'relative', minHeight: HOUR_HEIGHT * hours.length, borderLeft: '1px solid var(--line)' }}>
              {hours.map((hour) => (
                <button key={hour} onClick={() => onAddAt({ date: toInputDate(day), time: `${String(hour).padStart(2, '0')}:00` })} style={{ display: 'block', width: '100%', height: HOUR_HEIGHT, borderTop: '1px solid var(--line)', background: 'transparent' }} aria-label={`Ajouter ${hour}:00`} />
              ))}
              {dayBookings.map((booking) => {
                const layout = getBookingLayout(booking);
                return (
                  <button key={booking.id} onClick={(event) => { event.stopPropagation(); onSelect(booking); }} style={{ position: 'absolute', left: 7, right: 7, top: layout.top + 4, minHeight: layout.height, borderRadius: 12, padding: 9, background: `linear-gradient(135deg, ${statusColor[booking.status]}22, var(--bg-3))`, border: `1px solid ${statusColor[booking.status]}88`, color: 'var(--cream)', textAlign: 'left', overflow: 'hidden', boxShadow: '0 10px 26px rgba(0,0,0,.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 12 }}>{formatTime(booking.appointment_at)}</strong>
                      <span style={{ color: statusColor[booking.status], fontSize: 10, fontWeight: 700 }}>{statusLabel[booking.status]}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.client_name}</div>
                    <div style={{ color: 'var(--mute)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.services?.name}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddTab({ services, clients, initialSlot, onCreated }: { services: Service[]; clients: Client[]; initialSlot?: { date: string; time: string }; onCreated: (booking: Booking) => void }) {
  const [form, setForm] = useState<ManualForm>(() => initialForm(services, initialSlot));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialForm(services, initialSlot));
  }, [initialSlot?.date, initialSlot?.time, services]);

  const selectedService = services.find((service) => service.id === form.serviceId);
  const suggestions = clients.filter((client) => {
    const text = `${client.name} ${client.phone} ${client.email}`.toLowerCase();
    return query.trim().length >= 2 && text.includes(query.toLowerCase());
  }).slice(0, 5);

  const updateService = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      total: service ? String(service.price) : current.total,
      duration: service ? String(service.duration) : current.duration,
    }));
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
      setForm(initialForm(services));
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Creation impossible');
    } finally {
      setSaving(false);
    }
  };

  const valid = form.clientName.trim() && form.phone.trim() && form.serviceId && form.date && form.time && Number(form.total) > 0 && Number(form.duration) > 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionTitle title="Ajouter un RDV" sub="Telephone, DM ou passage direct" />
      <Card>
        <Field label="Rechercher une cliente">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom ou telephone" />
        </Field>
        {suggestions.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {suggestions.map((client) => (
              <button key={client.key} onClick={() => { setForm((current) => ({ ...current, clientName: client.name, phone: client.phone, email: client.email })); setQuery(''); }} style={{ textAlign: 'left', padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                <div style={{ fontWeight: 700 }}>{client.name}</div>
                <div style={{ color: 'var(--mute)', fontSize: 12 }}>{client.phone || 'Sans telephone'} · {client.email || 'Sans email'}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Nom cliente"><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Nom complet" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Telephone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" /></Field>
            <Field label="Email optionnel"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, sendClientEmail: e.target.value ? form.sendClientEmail : false })} placeholder="cliente@email.com" /></Field>
          </div>
          <Field label="Soin">
            <select className="select" value={form.serviceId} onChange={(e) => updateService(e.target.value)}>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Date"><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Heure"><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Prix"><input className="input" type="number" min="0" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
            <Field label="Duree"><input className="input" type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
            <Field label="Statut">
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                <option value="confirmed">Confirme</option>
                <option value="pending">A confirmer</option>
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Infos utiles" /></Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: form.email ? 'var(--cream)' : 'var(--mute)' }}>
            <input type="checkbox" disabled={!form.email} checked={form.sendClientEmail} onChange={(e) => setForm({ ...form, sendClientEmail: e.target.checked })} />
            Envoyer une confirmation a la cliente
          </label>
        </div>
        <div className="summary">
          <div className="summary-row"><span className="l">Soin</span><span>{selectedService?.name || '-'}</span></div>
          <div className="summary-row"><span className="l">Date</span><span>{form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString('fr-FR') : '-'}</span></div>
          <div className="summary-row"><span className="l">Total</span><span style={{ color: 'var(--gold)' }}>{money(Number(form.total))}</span></div>
        </div>
        {error && <div style={{ marginTop: 12, color: '#e57975', background: 'rgba(244,67,54,.1)', border: '1px solid rgba(244,67,54,.35)', padding: 12, borderRadius: 10, fontSize: 13 }}>{error}</div>}
        <button className="btn btn-gold" onClick={submit} disabled={!valid || saving} style={{ width: '100%', justifyContent: 'center', marginTop: 14, opacity: valid && !saving ? 1 : .45 }}>
          <Icon n="check" s={14} /> {saving ? 'Creation...' : 'Creer le RDV'}
        </button>
      </Card>
    </div>
  );
}

function ClientsTab({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState('');
  const filtered = clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionTitle title="Clients" sub={`${clients.length} fiches`} />
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une cliente" />
      {filtered.length === 0 ? <Empty icon="users" title="Aucune cliente" sub="Les clientes viennent des RDV existants." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((client) => (
            <Card key={client.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{client.name}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 13 }}>{client.visits} visite{client.visits > 1 ? 's' : ''} · {money(client.total)}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 3 }}>Dernier RDV: {new Date(client.last).toLocaleDateString('fr-FR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {client.phone && <a className="icon-btn" href={`tel:${client.phone}`}><Icon n="phone" s={14} /></a>}
                  {client.phone && <a className="icon-btn" href={`https://wa.me/${whatsappPhone(client.phone)}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}><Icon n="wa" s={14} /></a>}
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
        <div style={{ textTransform: 'capitalize', fontSize: 18, fontWeight: 700 }}>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon n="chev" s={15} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Kpi label="CA realise" value={money(stats.realized)} sub="termines + confirmes passes" />
        <Kpi label="CA prevu" value={money(stats.planned)} sub="futurs confirmes/a confirmer" />
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

function BookingCard({ booking, onSelect, onConfirm, onCancel, onComplete }: any) {
  const date = new Date(booking.appointment_at);
  const phone = whatsappPhone(booking.client_phone);
  const isPast = date < new Date();
  return (
    <article onClick={() => onSelect(booking)} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderLeft: `4px solid ${statusColor[booking.status]}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 700 }}>{formatTime(date)} · {booking.duration} min</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{booking.client_name}</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.services?.name || 'Soin'}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'grid', justifyItems: 'end', gap: 6 }}>
          <span className={`pill ${booking.status}`}>{statusLabel[booking.status]}</span>
          <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{money(booking.total)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        {booking.status === 'pending' && <button className="btn btn-gold btn-sm" onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); }}><Icon n="check" s={13} /> Confirmer</button>}
        {booking.status === 'confirmed' && isPast && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onComplete(booking.id); }}><Icon n="check" s={13} /> Termine</button>}
        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <>
            <a className="icon-btn" href={`tel:${booking.client_phone}`} onClick={(e) => e.stopPropagation()}><Icon n="phone" s={14} /></a>
            {phone && <a className="icon-btn" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#25D366' }}><Icon n="wa" s={14} /></a>}
            {booking.client_email && <a className="icon-btn" href={`mailto:${booking.client_email}`} onClick={(e) => e.stopPropagation()}><Icon n="mail" s={14} /></a>}
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); if (window.confirm('Annuler ce rendez-vous ?')) onCancel(booking.id); }}><Icon n="close" s={14} /></button>
          </>
        )}
      </div>
    </article>
  );
}

function BookingSheet({ booking, onClose, onConfirm, onCancel, onComplete, onReschedule, onDelete }: any) {
  const date = new Date(booking.appointment_at);
  const [editDate, setEditDate] = useState(toInputDate(date));
  const [editTime, setEditTime] = useState(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
  const [editDuration, setEditDuration] = useState(String(booking.duration));
  const phone = whatsappPhone(booking.client_phone);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.56)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 660, margin: '0 auto', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '20px 20px 0 0', padding: 18, display: 'grid', gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: 'var(--gold)', textTransform: 'capitalize', fontSize: 13 }}>{formatDay(date)} · {formatTime(date)}</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700 }}>{booking.client_name}</h2>
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
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Date"><input className="input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></Field>
            <Field label="Heure"><input className="input" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} /></Field>
            <Field label="Duree"><input className="input" type="number" min="1" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} /></Field>
          </div>
          <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => onReschedule(booking.id, new Date(`${editDate}T${editTime}:00`).toISOString(), Number(editDuration))}>
            <Icon n="calendar" s={14} /> Reprogrammer
          </button>
        </Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {booking.status === 'pending' && <button className="btn btn-gold" onClick={() => onConfirm(booking.id)}><Icon n="check" s={14} /> Confirmer</button>}
          {booking.status !== 'completed' && booking.status !== 'cancelled' && <button className="btn btn-ghost" onClick={() => onComplete(booking.id)}><Icon n="check" s={14} /> Termine</button>}
          {booking.status !== 'cancelled' && <button className="btn btn-ghost" onClick={() => { if (window.confirm('Annuler ce rendez-vous ?')) onCancel(booking.id); }}><Icon n="close" s={14} /> Annuler</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <a className="btn btn-ghost" href={`tel:${booking.client_phone}`} style={{ justifyContent: 'center' }}><Icon n="phone" s={14} /> Appel</a>
          <a className="btn btn-ghost" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" style={{ justifyContent: 'center', color: '#25D366' }}><Icon n="wa" s={14} /> WhatsApp</a>
          <a className="btn btn-ghost" href={`mailto:${booking.client_email}`} style={{ justifyContent: 'center', opacity: booking.client_email ? 1 : .45, pointerEvents: booking.client_email ? 'auto' : 'none' }}><Icon n="mail" s={14} /> Email</a>
        </div>
        <button className="btn btn-ghost" style={{ justifyContent: 'center', color: '#e57975', borderColor: 'rgba(229,121,117,.45)' }} onClick={() => { if (window.confirm('Supprimer definitivement ce RDV ?')) onDelete(booking.id); }}>
          Supprimer definitivement
        </button>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
      {options.map((option: any) => <button key={option.value} onClick={() => onChange(option.value)} style={{ padding: '10px 8px', borderRadius: 9, background: value === option.value ? 'var(--cream)' : 'transparent', color: value === option.value ? 'var(--bg)' : 'var(--mute)', fontSize: 13, fontWeight: 700 }}>{option.label}</button>)}
    </div>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <div style={{ color: 'var(--mute)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>{label}</div>
      <div style={{ color: 'var(--gold)', fontSize: 25, lineHeight: 1, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: 'var(--mute)', fontSize: 11.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h1>
      {sub && <span style={{ color: 'var(--mute)', fontSize: 12 }}>{sub}</span>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>{children}</div>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
      <span style={{ color: 'var(--mute)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function Empty({ title, sub, icon }: { title: string; sub: string; icon: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px dashed var(--line-2)', borderRadius: 14, padding: '38px 20px', textAlign: 'center' }}>
      <div style={{ color: 'var(--gold)', marginBottom: 10 }}><Icon n={icon} s={25} /></div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
