'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';
import { formatServicePrice } from '@/lib/services';
import { parisAppointment, parisDateInput, remainingPlaces, treatmentSummary, type AvailabilityWindow, type TreatmentMode } from '@/lib/scheduling';

type Service = { id: string; name: string; category: string; price: number; old_price?: number | null; duration: number; note?: string | null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['Prestations', 'Date', 'Vos infos'];
function dateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
const SLOTS = Array.from({ length: 17 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export function BookingWizard({ services, preselectId }: { services: Service[]; preselectId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    serviceIds: services.some((s) => s.id === preselectId) ? [preselectId!] : [] as string[],
    treatmentMode: 'simultaneous' as TreatmentMode,
    date: null as Date | null, time: null as string | null,
    name: '', email: '', phone: '', notes: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loadedDate, setLoadedDate] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const selectedDate = data.date ? dateInput(data.date) : '';
  const selectedServices = services.filter((s) => data.serviceIds.includes(s.id));
  const summary = treatmentSummary(selectedServices, data.treatmentMode);
  const clientOk = data.name.trim().length > 1 && EMAIL_RE.test(data.email.trim()) && data.phone.replace(/\D/g, '').length >= 9;
  const byCat = useMemo(() => {
    const categories: Record<string, Service[]> = {};
    services.forEach((s) => { (categories[s.category] ||= []).push(s); });
    return categories;
  }, [services]);

  useEffect(() => {
    if (!selectedDate) return;
    const controller = new AbortController();
    setLoadedDate('');
    setAvailabilityError('');
    fetch(`/api/availability?date=${selectedDate}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Disponibilités indisponibles.');
        if (!controller.signal.aborted) { setWindows(json.windows); setLoadedDate(selectedDate); }
      })
      .catch((error) => { if (!controller.signal.aborted) setAvailabilityError(error.message); });
    return () => controller.abort();
  }, [selectedDate, refresh]);

  const placesFor = (time: string) => {
    if (!selectedDate || loadedDate !== selectedDate || !summary.duration) return 0;
    const start = parisAppointment(selectedDate, time);
    if (Date.parse(start) <= Date.now() || Date.parse(start) + summary.duration * 60000 > Date.parse(parisAppointment(selectedDate, '20:00'))) return 0;
    return remainingPlaces(start, summary.duration, windows);
  };
  const valid: Record<number, boolean> = {
    1: selectedServices.length > 0,
    2: !!data.time && placesFor(data.time) > 0,
    3: clientOk && !!data.time && placesFor(data.time) > 0,
  };
  const chooseService = (id: string) => {
    setError(null);
    setData((current) => ({ ...current, serviceIds: current.serviceIds.includes(id) ? current.serviceIds.filter((x) => x !== id) : [...current.serviceIds, id], time: null }));
  };
  const goNext = () => { setError(null); if (valid[step]) setStep((s) => Math.min(3, s + 1)); };
  const submit = async () => {
    if (sending || !valid[3]) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceIds: data.serviceIds, treatmentMode: data.treatmentMode,
          appointmentAt: parisAppointment(selectedDate, data.time!), name: data.name.trim(),
          email: data.email.trim(), phone: data.phone.trim(), notes: data.notes.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setData((d) => ({ ...d, time: null })); setStep(2); setRefresh((n) => n + 1); }
        throw new Error(json.error || 'La réservation a échoué. Veuillez réessayer.');
      }
      router.push(`/confirm?id=${json.id}`);
    } catch (error: any) { setError(error.message); setSending(false); }
  };

  return (
    <div className="wizard">
      <div className="steps" aria-label="Étapes de réservation">
        {STEP_LABELS.map((label, i) => <div key={label} className={'step ' + (step === i + 1 ? 'active' : '') + (step > i + 1 ? ' done' : '')} aria-current={step === i + 1 ? 'step' : undefined}><span>{step > i + 1 ? <Icon n="check" s={10} /> : i + 1}</span><span>{label}</span></div>)}
      </div>
      <Reveal>
        <div className="wiz-card">
          {step === 1 && <>
            <h2 className="wiz-h">Choisir les prestations</h2>
            <p className="wiz-sub">Sélectionnez un ou plusieurs soins pour votre rendez-vous.</p>
            {Object.entries(byCat).map(([category, items]) => <div key={category} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>{category}</div>
              <div className="svc-list">{items.map((s) => <button key={s.id} type="button" className={'svc-row ' + (data.serviceIds.includes(s.id) ? 'selected' : '')} aria-pressed={data.serviceIds.includes(s.id)} onClick={() => chooseService(s.id)}>
                <div className="svc-tx"><div className="t">{s.name}</div><div className="d">{s.duration} min</div></div>
                <div className="svc-pr">{formatServicePrice(s)} {data.serviceIds.includes(s.id) && <Icon n="check" s={14} />}</div>
              </button>)}</div>
            </div>)}
            {selectedServices.length > 1 && <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="booking-treatment-mode">Organisation des soins</label>
              <select id="booking-treatment-mode" className="select" value={data.treatmentMode} onChange={(e) => setData((d) => ({ ...d, treatmentMode: e.target.value as TreatmentMode, time: null }))}>
                <option value="simultaneous">En même temps</option><option value="sequential">À la suite</option>
              </select>
              <p style={{ color: 'var(--mute)', fontSize: 12, marginTop: 8 }}>{data.treatmentMode === 'simultaneous' ? 'Les soins commencent ensemble : la durée est celle du soin le plus long.' : 'Les durées des soins s’additionnent.'}</p>
            </div>}
          </>}
          {step === 2 && <>
            <h2 className="wiz-h">Choisir le créneau</h2>
            <p className="wiz-sub">Jusqu’à deux clientes en même temps. Les créneaux complets ou fermés sont grisés. Horaires de Paris.</p>
            <Calendar value={data.date} onChange={(date) => { setError(null); setData((d) => ({ ...d, date, time: null })); }} />
            {selectedDate && <>
              {availabilityError ? <div role="alert" style={{ marginTop: 14, color: 'var(--danger)' }}>{availabilityError}<button type="button" className="btn btn-ghost" onClick={() => setRefresh((n) => n + 1)}>Réessayer</button></div> : loadedDate !== selectedDate ? <p role="status" style={{ color: 'var(--mute)', marginTop: 14 }}>Chargement des disponibilités…</p> : <>
                <div className="slots" aria-label="Créneaux disponibles">{SLOTS.map((time) => {
                  const places = placesFor(time);
                  return <button key={time} type="button" className={'slot ' + (data.time === time ? 'selected' : '') + (!places ? ' disabled' : '')} disabled={!places} aria-pressed={data.time === time} aria-label={`${time}, ${places ? `${places} place${places > 1 ? 's' : ''} disponible${places > 1 ? 's' : ''}` : 'indisponible'}`} onClick={() => setData((d) => ({ ...d, time }))}>
                    {time}<span style={{ display: 'block', fontSize: 10, fontWeight: 400, marginTop: 3 }}>{places ? `${places} place${places > 1 ? 's' : ''}` : 'Indisponible'}</span>
                  </button>;
                })}</div>
                {!SLOTS.some((time) => placesFor(time) > 0) && <p role="status" style={{ color: 'var(--mute)', marginTop: 14 }}>Aucun créneau disponible pour ces soins. Choisissez une autre date.</p>}
              </>}
            </>}
          </>}
          {step === 3 && <>
            <h2 className="wiz-h">Vos coordonnées</h2>
            <p className="wiz-sub">{selectedDate} · {data.time} (heure de Paris)</p>
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="field"><label htmlFor="booking-name">Nom complet *</label><input id="booking-name" className="input" value={data.name} onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))} placeholder="Votre nom" autoComplete="name" required /></div>
              <div className="form-grid-2">
                <div className="field"><label htmlFor="booking-email">Email *</label><input id="booking-email" className="input" type="email" value={data.email} onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))} placeholder="vous@email.com" autoComplete="email" required /></div>
                <div className="field"><label htmlFor="booking-phone">Téléphone *</label><input id="booking-phone" className="input" type="tel" value={data.phone} onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))} placeholder="06 12 34 56 78" autoComplete="tel" required /></div>
              </div>
              <div className="field"><label htmlFor="booking-notes">Notes (optionnel)</label><textarea id="booking-notes" className="textarea" value={data.notes} onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))} placeholder="Allergies, première visite…" /></div>
            </div>
          </>}
          {selectedServices.length > 0 && <div className="summary">
            <div className="summary-row"><span className="l">Prestations</span><span>{summary.name}</span></div>
            <div className="summary-row"><span className="l">Durée</span><span>{summary.duration} min{selectedServices.length > 1 ? ` · ${data.treatmentMode === 'simultaneous' ? 'en même temps' : 'à la suite'}` : ''}</span></div>
            <div className="summary-row"><span className="l">Total à régler sur place</span><span style={{ color: 'var(--gold)' }}>{summary.total}€{selectedServices.some((s) => s.note?.toLowerCase().startsWith('à partir')) ? ' (à partir de)' : ''}</span></div>
          </div>}
          {error && <div role="alert" style={{ marginTop: 14, padding: 12, border: '1px solid var(--danger)', borderRadius: 10, color: 'var(--danger)' }}>{error}</div>}
          <div className="wiz-nav" style={{ justifyContent: step === 1 ? 'flex-end' : 'space-between' }}>
            {step > 1 && <button type="button" className="btn btn-ghost" disabled={sending} onClick={() => { setError(null); setStep((s) => s - 1); }}><Icon n="arrowL" s={13} /> Retour</button>}
            {step < 3 ? <button type="button" className="btn btn-primary" onClick={goNext} disabled={!valid[step]} style={{ opacity: valid[step] ? 1 : .45 }}>Continuer <Icon n="arrow" s={13} /></button> : <button type="button" className="btn btn-gold" onClick={submit} disabled={!valid[3] || sending} style={{ opacity: valid[3] && !sending ? 1 : .45 }}>{sending ? 'Confirmation…' : 'Confirmer le rendez-vous'} <Icon n="check" s={13} /></button>}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Calendar({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const [view, setView] = useState(() => value ? new Date(value) : new Date());
  const today = new Date(`${parisDateInput()}T00:00:00`);
  const y = view.getFullYear(); const m = view.getMonth();
  const startDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  const dow = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

  return (
    <div>
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Mois précédent"><Icon n="chevL" s={14} /></button>
        <div className="cal-title">{view.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <button type="button" className="icon-btn" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Mois suivant"><Icon n="chev" s={14} /></button>
      </div>
      <div className="cal-grid">
        {dow.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today;
          const sel = value && new Date(value).toDateString() === d.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <button
              type="button"
              key={i}
              className={'cal-day ' + (past ? 'disabled' : '') + (sel ? ' selected' : '') + (isToday ? ' today' : '')}
              disabled={past}
              aria-pressed={!!sel}
              aria-label={label}
              onClick={() => onChange(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
