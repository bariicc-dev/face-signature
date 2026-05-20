'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';

type Service = { id: string; name: string; category: string; price: number; duration: number; note?: string | null };
type Busy = { appointment_at: string; duration: number; status: string };

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

  const submit = async () => {
    if (!svc || !data.date || !data.time) return;
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
          name: data.name,
          email: data.email,
          phone: data.phone,
          notes: data.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      router.push(`/confirm?id=${json.id}`);
    } catch (e: any) {
      setError(e.message);
      setSending(false);
    }
  };

  const valid: Record<number, boolean> = {
    1: !!data.serviceId,
    2: !!data.date && !!data.time,
    3: !!(data.name && data.email && data.phone),
  };
  const stepLabels = ['Soin', 'Date', 'Vos infos'];

  return (
    <div className="wizard">
      <div className="steps">
        {stepLabels.map((l, i) => (
          <div key={i} className={'step ' + (step === i + 1 ? 'active' : '') + (step > i + 1 ? ' done' : '')}>
            {step > i + 1 ? <Icon n="check" s={10} /> : i + 1}{l}
          </div>
        ))}
      </div>

      <Reveal>
        <div className="wiz-card">
          {step === 1 && (
            <>
              <h2 className="wiz-h">Quel soin ?</h2>
              <p className="wiz-sub">Choisissez votre prestation.</p>
              {Object.keys(byCat).map(cat => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 500 }}>{cat}</div>
                  <div className="svc-list">
                    {byCat[cat].map(s => (
                      <div key={s.id} className={'svc-row ' + (data.serviceId === s.id ? 'selected' : '')} onClick={() => setData(d => ({ ...d, serviceId: s.id }))}>
                        <div className="svc-tx">
                          <div className="t">{s.name}</div>
                          <div className="d">{s.duration} min{s.note ? ' · ' + s.note : ''}</div>
                        </div>
                        <div className="svc-pr">{s.price}€</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="wiz-h">Quand ?</h2>
              <p className="wiz-sub">Choisissez une date puis un créneau disponible.</p>
              <Calendar value={data.date} onChange={d => setData(x => ({ ...x, date: d, time: null }))} />
              {data.date && (
                <div className="slots">
                  {slots.map(t => {
                    const booked = isSlotBooked(data.date!, t);
                    return (
                      <div
                        key={t}
                        className={'slot ' + (data.time === t ? 'selected' : '') + (booked ? ' disabled' : '')}
                        onClick={() => !booked && setData(d => ({ ...d, time: t }))}
                      >
                        {t}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="wiz-h">Vos coordonnées</h2>
              <p className="wiz-sub">Vous recevrez un email de confirmation.</p>
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="field"><label>Nom complet</label><input className="input" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Votre nom" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="field"><label>Email</label><input className="input" type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="vous@email.com" /></div>
                  <div className="field"><label>Téléphone</label><input className="input" type="tel" value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} placeholder="06 12 34 56 78" /></div>
                </div>
                <div className="field"><label>Notes (optionnel)</label><textarea className="textarea" value={data.notes} onChange={e => setData(d => ({ ...d, notes: e.target.value }))} placeholder="Allergies, première visite..." /></div>
              </div>

              <div className="summary" style={{ marginTop: 20 }}>
                <div className="summary-row"><span className="l">Soin</span><span>{svc?.name}</span></div>
                <div className="summary-row"><span className="l">Date</span><span style={{ textTransform: 'capitalize' }}>{new Date(data.date!).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                <div className="summary-row"><span className="l">Heure</span><span>{data.time}</span></div>
                <div className="summary-row"><span className="l">Total à régler en institut</span><span style={{ color: 'var(--gold)', fontWeight: 500 }}>{svc?.price}€</span></div>
              </div>
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 10, fontSize: 12.5, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon n="check" s={14} /> Aucun paiement maintenant. Vous réglez sur place.
              </div>
              {error && <div style={{ marginTop: 14, padding: 12, background: 'rgba(244,67,54,.1)', border: '1px solid #e57975', borderRadius: 10, color: '#e57975', fontSize: 13 }}>{error}</div>}
            </>
          )}

          <div className="wiz-nav">
            {step > 1 ? <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}><Icon n="arrowL" s={13} /> Retour</button> : <span />}
            {step < 3 ? (
              <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!valid[step]} style={{ opacity: valid[step] ? 1 : 0.4 }}>
                Continuer <Icon n="arrow" s={13} />
              </button>
            ) : (
              <button className="btn btn-gold" onClick={submit} disabled={!valid[3] || sending} style={{ opacity: valid[3] && !sending ? 1 : 0.4 }}>
                {sending ? 'Envoi…' : 'Confirmer le rendez-vous'} <Icon n="check" s={13} />
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
        <button className="icon-btn" onClick={() => setView(new Date(y, m - 1, 1))}><Icon n="chevL" s={14} /></button>
        <div className="cal-title">{view.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <button className="icon-btn" onClick={() => setView(new Date(y, m + 1, 1))}><Icon n="chev" s={14} /></button>
      </div>
      <div className="cal-grid">
        {dow.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today;
          const sel = value && new Date(value).toDateString() === d.toDateString();
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div
              key={i}
              className={'cal-day ' + (past ? 'disabled' : '') + (sel ? ' selected' : '') + (isToday ? ' today' : '')}
              onClick={() => !past && onChange(d)}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
