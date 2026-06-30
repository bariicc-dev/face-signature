'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';

type Service = { id: string; name: string; category: string; price: number; duration: number; note?: string | null };
type Busy = { appointment_at: string; duration: number; status: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['Soin', 'Date', 'Vos infos'];

export function BookingWizard({ services, busy, preselectId }: { services: Service[]; busy: Busy[]; preselectId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    serviceId: preselectId || null as string | null,
    date: null as Date | null,
    time: null as string | null,
    name: '', email: '', phone: '', notes: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svc = services.find(s => s.id === data.serviceId);
  const nameOk = data.name.trim().length > 1;
  const emailOk = EMAIL_RE.test(data.email.trim());
  const phoneOk = data.phone.replace(/\D/g, '').length >= 9;
  const clientOk = nameOk && emailOk && phoneOk;

  const byCat = useMemo(() => {
    const m: Record<string, Service[]> = {};
    services.forEach(s => { if (!m[s.category]) m[s.category] = []; m[s.category].push(s); });
    return m;
  }, [services]);

  const isSlotBooked = (date: Date, time: string) => {
    if (!svc) return false;
    const d = new Date(date);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    const end = new Date(d); end.setMinutes(end.getMinutes() + svc.duration);
    return busy.some(b => {
      const bd = new Date(b.appointment_at);
      const be = new Date(bd); be.setMinutes(be.getMinutes() + b.duration);
      return d < be && end > bd;
    });
  };

  const slots: string[] = [];
  for (let h = 10; h <= 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 18) slots.push(`${String(h).padStart(2, '0')}:30`);
  }

  const valid: Record<number, boolean> = {
    1: !!data.serviceId,
    2: !!data.date && !!data.time,
    3: clientOk,
  };

  const goNext = () => {
    setError(null);
    if (!valid[step]) return;
    setStep(s => Math.min(3, s + 1));
  };

  const submit = async () => {
    if (sending) return;
    if (!svc || !data.date || !data.time) {
      setError('Choisissez un soin, une date et un créneau avant de confirmer.');
      return;
    }
    if (!clientOk) {
      setError('Renseignez votre nom, un email valide et un téléphone.');
      return;
    }

    setSending(true);
    setError(null);
    const d = new Date(data.date);
    const [h, m] = data.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: svc.id,
          appointmentAt: d.toISOString(),
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          notes: data.notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'La réservation n\'a pas pu être envoyée. Réessayez dans un instant.');
      router.push(`/confirm?id=${json.id}`);
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue. Réessayez ou contactez l\'institut sur WhatsApp.');
      setSending(false);
    }
  };

  return (
    <div className="wizard">
      <div className="steps" aria-label="Étapes de réservation">
        {STEP_LABELS.map((label, i) => {
          const current = step === i + 1;
          const done = step > i + 1;
          return (
            <div key={label} className={'step ' + (current ? 'active' : '') + (done ? ' done' : '')} aria-current={current ? 'step' : undefined}>
              <span>{done ? <Icon n="check" s={10} /> : i + 1}</span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      <Reveal>
        <div className="wiz-card">
          {step === 1 && (
            <>
              <h2 className="wiz-h">Choisir le soin</h2>
              <p className="wiz-sub">Sélectionnez la prestation souhaitée. Le prix et la durée restent visibles avant confirmation.</p>
              {Object.keys(byCat).map(cat => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 500 }}>{cat}</div>
                  <div className="svc-list">
                    {byCat[cat].map(s => (
                      <button key={s.id} type="button" className={'svc-row ' + (data.serviceId === s.id ? 'selected' : '')} aria-pressed={data.serviceId === s.id} onClick={() => setData(d => ({ ...d, serviceId: s.id }))}>
                        <div className="svc-tx">
                          <div className="t">{s.name}</div>
                          <div className="d">{s.duration} min{s.note ? ' · ' + s.note : ''}</div>
                        </div>
                        <div className="svc-pr">{s.price}€</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="wiz-h">Choisir le créneau</h2>
              <p className="wiz-sub">Les créneaux déjà réservés sont grisés. Sélectionnez une date puis une heure disponible.</p>
              {svc && (
                <div className="summary" style={{ marginTop: 0, marginBottom: 18 }}>
                  <div className="summary-row"><span className="l">Soin sélectionné</span><span>{svc.name}</span></div>
                  <div className="summary-row"><span className="l">Durée</span><span>{svc.duration} min</span></div>
                </div>
              )}
              <Calendar value={data.date} onChange={d => setData(x => ({ ...x, date: d, time: null }))} />
              {data.date && (
                <div className="slots" aria-label="Créneaux disponibles">
                  {slots.map(t => {
                    const booked = isSlotBooked(data.date!, t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={'slot ' + (data.time === t ? 'selected' : '') + (booked ? ' disabled' : '')}
                        disabled={booked}
                        aria-pressed={data.time === t}
                        aria-label={booked ? `${t}, déjà réservé` : `${t}, disponible`}
                        onClick={() => setData(d => ({ ...d, time: t }))}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="wiz-h">Vos coordonnées</h2>
              <p className="wiz-sub">Un email de confirmation vous sera envoyé après la demande.</p>
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="field">
                  <label htmlFor="booking-name">Nom complet *</label>
                  <input id="booking-name" className="input" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Votre nom" autoComplete="name" required />
                </div>
                <div className="form-grid-2">
                  <div className="field">
                    <label htmlFor="booking-email">Email *</label>
                    <input id="booking-email" className="input" type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="vous@email.com" autoComplete="email" required />
                  </div>
                  <div className="field">
                    <label htmlFor="booking-phone">Téléphone *</label>
                    <input id="booking-phone" className="input" type="tel" value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} placeholder="06 12 34 56 78" autoComplete="tel" required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="booking-notes">Notes (optionnel)</label>
                  <textarea id="booking-notes" className="textarea" value={data.notes} onChange={e => setData(d => ({ ...d, notes: e.target.value }))} placeholder="Allergies, première visite..." />
                </div>
              </div>

              <div className="summary" style={{ marginTop: 20 }}>
                <div className="summary-row"><span className="l">Soin</span><span>{svc?.name}</span></div>
                <div className="summary-row"><span className="l">Date</span><span style={{ textTransform: 'capitalize' }}>{new Date(data.date!).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                <div className="summary-row"><span className="l">Heure</span><span>{data.time}</span></div>
                <div className="summary-row"><span className="l">Total à régler en institut</span><span style={{ color: 'var(--gold)', fontWeight: 500 }}>{svc?.price}€</span></div>
              </div>

              <div className="microcopy-grid">
                <div className="microcopy-item"><Icon n="check" s={14} /> Aucun paiement maintenant</div>
                <div className="microcopy-item"><Icon n="mail" s={14} /> Vous recevrez un email de confirmation</div>
                <div className="microcopy-item"><Icon n="phone" s={14} /> L'institut vous contactera si besoin</div>
              </div>
              {error && <div aria-live="polite" style={{ marginTop: 14, padding: 12, background: 'rgba(244,67,54,.1)', border: '1px solid var(--danger)', borderRadius: 10, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
            </>
          )}

          <div className="wiz-nav">
            {step > 1 ? <button type="button" className="btn btn-ghost" onClick={() => { setError(null); setStep(s => s - 1); }}><Icon n="arrowL" s={13} /> Retour</button> : <span />}
            {step < 3 ? (
              <button type="button" className="btn btn-primary" onClick={goNext} disabled={!valid[step]} style={{ opacity: valid[step] ? 1 : 0.45 }}>
                Continuer <Icon n="arrow" s={13} />
              </button>
            ) : (
              <button type="button" className="btn btn-gold" onClick={submit} disabled={!valid[3] || sending} style={{ opacity: valid[3] && !sending ? 1 : 0.45 }}>
                {sending ? 'Confirmation en cours...' : 'Confirmer le rendez-vous'} <Icon n="check" s={13} />
              </button>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Calendar({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const [view, setView] = useState(() => value ? new Date(value) : new Date());
  const today = new Date(); today.setHours(0, 0, 0, 0);
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
          const isToday = d.toDateString() === new Date().toDateString();
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
