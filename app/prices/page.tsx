import Link from 'next/link';
import { Icon, FlowerSVG } from '@/components/Icon';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { Reveal } from '@/components/Reveal';
import { createClient } from '@/lib/supabase-server';
import { formatServicePrice, getDisplayServices } from '@/lib/services';

type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  old_price?: number | null;
  duration?: number | null;
  note?: string | null;
};

export default async function PricesPage() {
  const sb = createClient();
  const { data: services } = await sb.from('services').select('*').eq('active', true).order('sort_order');
  const byCat: Record<string, Service[]> = {};
  getDisplayServices(services).forEach((s: Service) => {
    if (!byCat[s.category]) byCat[s.category] = [];
    byCat[s.category].push(s);
  });
  const cats = Object.keys(byCat).map((name, i) => ({ name, num: String(i + 1).padStart(2, '0'), services: byCat[name] }));

  return (
    <>
      <Nav />
      <main className="page" style={{ overflow: 'hidden' }}>
        <div className="flower" style={{ top: '5%', right: '8%', width: 70, height: 70 }}><FlowerSVG color="var(--gold)" opacity={0.3} /></div>
        <div className="flower" style={{ bottom: '15%', left: '4%', width: 60, height: 60, animationDelay: '-3s' }}><FlowerSVG color="var(--rose)" opacity={0.3} /></div>

        <div className="page-head">
          <div className="eyebrow">Carte</div>
          <h1>Nos <em>tarifs</em>.</h1>
          <p>Choisissez un soin, vérifiez la durée et réservez directement sans paiement en ligne.</p>
        </div>

        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 54, position: 'relative', zIndex: 2 }}>
          {cats.map((c, i) => (
            <Reveal key={c.name} delay={i * 80}>
              <section aria-labelledby={`cat-${i}`}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, fontSize: 28, color: 'var(--gold)' }}>{c.num}</span>
                  <h2 id={`cat-${i}`} style={{ fontSize: 30, fontWeight: 300, letterSpacing: 0, margin: 0 }}>{c.name}</h2>
                </div>
                <div>
                  {c.services.map(s => (
                    <Link key={s.id} href={`/book?service=${s.id}`} className="price-row" aria-label={`Réserver ${s.name}`}>
                      <div>
                        <span className="price-name">{s.name}</span>
                        {s.note && !s.note.toLowerCase().startsWith('à partir') && <small className="price-note">{s.note}</small>}
                      </div>
                      <span className="price-duration">{s.duration ? `${s.duration} min` : 'Durée à confirmer'}</span>
                      <span>{s.old_price ? <span className="old-price">{s.old_price}€</span> : null}</span>
                      <span className="new-price">{formatServicePrice(s)}</span>
                      <span className="book-label">Réserver</span>
                    </Link>
                  ))}
                </div>
              </section>
            </Reveal>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 52, position: 'relative', zIndex: 2 }}>
          <Link href="/book" className="btn btn-gold">Prendre rendez-vous <Icon n="arrow" s={14} /></Link>
        </div>
      </main>
      <Footer />
      <FabWA />
    </>
  );
}
