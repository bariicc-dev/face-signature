'use client';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { addCalendarDays, parisAppointment, parisDateInput, SALON_TIME_ZONE, type BlockedPeriod } from '@/lib/scheduling';

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', { timeZone: SALON_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function BlockedPeriods({ periods, onCreated, onDeleted }: { periods: BlockedPeriod[]; onCreated: (period: BlockedPeriod) => void; onDeleted: (id: string) => void }) {
  const [allDay, setAllDay] = useState(false);
  const [fromDate, setFromDate] = useState(parisDateInput());
  const [untilDate, setUntilDate] = useState(parisDateInput());
  const [fromTime, setFromTime] = useState('10:00');
  const [untilTime, setUntilTime] = useState('12:00');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const upcoming = [...periods].filter((p) => Date.parse(p.ends_at) > Date.now()).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const startsAt = parisAppointment(fromDate, allDay ? '00:00' : fromTime);
      const endsAt = parisAppointment(allDay ? addCalendarDays(untilDate, 1) : untilDate, allDay ? '00:00' : untilTime);
      if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('La fin doit être après le début.');
      const response = await fetch('/api/admin/blocked-periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt, endsAt, label }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Impossible de bloquer cette période.');
      onCreated(json.period); setLabel(''); setMessage('Période bloquée : aucune réservation ne pourra être ajoutée pendant cette absence.');
    } catch (error: any) { setError(error.message); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Rouvrir cette période aux réservations ?')) return;
    setDeleting(id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/blocked-periods?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Impossible de débloquer cette période.');
      onDeleted(id); setMessage('Période débloquée.');
    } catch (error: any) { setError(error.message); }
    finally { setDeleting(null); }
  };
  return <div style={{ display: 'grid', gap: 16 }}>
    <div><h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Absences et créneaux bloqués</h1><p style={{ color: 'var(--mute)', fontSize: 13 }}>Pause, congés ou fermeture : le blocage ferme les deux places. Horaires de Paris.</p></div>
    <form onSubmit={submit} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />Journées entières / congés</label>
      <div className="field"><label htmlFor="absence-label">Motif (visible uniquement dans l’admin)</label><input id="absence-label" className="input" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Congés, pause, rendez-vous personnel…" /></div>
      <div className="form-grid-2">
        <div className="field"><label htmlFor="absence-start-date">{allDay ? 'Premier jour inclus' : 'Date de début'}</label><input id="absence-start-date" className="input" type="date" value={fromDate} required onChange={(e) => { setFromDate(e.target.value); if (e.target.value > untilDate) setUntilDate(e.target.value); }} /></div>
        <div className="field"><label htmlFor="absence-end-date">{allDay ? 'Dernier jour inclus' : 'Date de fin'}</label><input id="absence-end-date" className="input" type="date" min={fromDate} value={untilDate} required onChange={(e) => setUntilDate(e.target.value)} /></div>
      </div>
      {!allDay && <div className="form-grid-2">
        <div className="field"><label htmlFor="absence-start-time">Heure de début</label><input id="absence-start-time" className="input" type="time" value={fromTime} required onChange={(e) => setFromTime(e.target.value)} /></div>
        <div className="field"><label htmlFor="absence-end-time">Heure de fin</label><input id="absence-end-time" className="input" type="time" value={untilTime} required onChange={(e) => setUntilTime(e.target.value)} /></div>
      </div>}
      <p style={{ color: 'var(--mute)', fontSize: 12 }}>Les RDV déjà réservés doivent être déplacés ou annulés avant de bloquer la période.</p>
      <button className="btn btn-gold" disabled={saving} style={{ justifyContent: 'center', opacity: saving ? .5 : 1 }}><Icon n="calendar" s={14} />{saving ? 'Blocage…' : 'Bloquer cette période'}</button>
    </form>
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    {message && <p role="status" style={{ color: 'var(--gold)', fontSize: 13 }}>{message}</p>}
    <h2 style={{ fontSize: 17, fontWeight: 600 }}>Périodes bloquées ({upcoming.length})</h2>
    {!upcoming.length && <p style={{ color: 'var(--mute)', fontSize: 13 }}>Aucune absence prévue.</p>}
    {upcoming.map((period) => <div key={period.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <div style={{ minWidth: 0 }}><strong>{period.label}</strong><div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 5 }}>{formatDate(period.starts_at)} → {formatDate(period.ends_at)}</div></div>
      <button type="button" className="btn btn-ghost" disabled={deleting !== null} onClick={() => remove(period.id)} aria-label={`Débloquer ${period.label}`}>{deleting === period.id ? '…' : 'Débloquer'}</button>
    </div>)}
  </div>;
}
