import Link from 'next/link';
import { Icon, FlowerSVG } from '@/components/Icon';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { Reveal } from '@/components/Reveal';
import { createClient } from '@/lib/supabase-server';

export default async function PricesPage() {
  const sb = createClient();
  const { data: services } = await sb.from('services').select('*').eq('active', true).order('sort_order');
  const byCat: Record<string, any[]> = {};
  (services || []).forEach(s => { if (!byCat[s.category]) byCat[s.category] = []; byCat[s.category].push(s); });
  const cats = Object.keys(byCat).map((name, i) => ({ name, num: String(i + 1).padStart(2, '0'), services: byCat[name] }));

  return (
    <>
      <Nav />
      <div className="page" style={{ overflow: 'hidden' }}>
        <div className="flower" style={{ top: '5%', right: '8%', width: 70, height: 70 }}><FlowerSVG color="var(--gold)" opacity={0.3} /></div>
        <div className="flower" style={{ bottom: '15%', left: '4%', width: 60, height: 60, animationDelay: '-3s' }}><FlowerSVG color="var(--rose)" opacity={0.3} /></div>

        <div className="page-head">
          <div className="eyebrow">Carte</div>
          <h1>Nos <em>tarifs</em>.</h1>
          <p>Cliquez sur un soin pour le réserver directement.</p>
        </div>

        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 60, position: 'relative', zIndex: 2 }}>
          {cats.map((c, i) => (
            <Reveal key={c.name} delay={i * 80}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, fontSize: 28, color: 'var(--gold)' }}>{c.num}</span>
                  <h3 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-.02em', margin: 0 }}>{c.name}</h3>
                </div>
                {c.services.map(s => (
                  <Link key={s.id} href={`/book?service=${s.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'baseline', padding: '14px 0', borderBottom: '1px dashed var(--line)' }}>
                    <div style={{ fontSize: 16 }}>
                      {s.name}
                      {s.note && <small style={{ display: 'block', fontSize: 12.5, color: 'var(--mute)', marginTop: 3 }}>{s.note}</small>}
                    </div>
                    {s.old_price ? <div style={{ textDecoration: 'line-through', color: 'var(--mute)', fontSize: 14 }}>{s.old_price}€</div> : <div />}
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--gold)' }}>{s.price}€</div>
                  </Link>
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <Link href="/book" className="btn btn-gold">Réserver un soin <Icon n="arrow" s={14} /></Link>
        </div>
      </div>
      <Footer />
      <FabWA />
    </>
  );
}
