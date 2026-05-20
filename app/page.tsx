import Link from 'next/link';
import { Icon, FlowerSVG } from '@/components/Icon';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { createClient } from '@/lib/supabase-server';
import { Reveal } from '@/components/Reveal';

const HERO_IMG = 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=900&q=80';

async function getServices() {
  const sb = createClient();
  const { data } = await sb.from('services').select('*').eq('active', true).order('sort_order');
  return data || [];
}

export default async function Home() {
  const services = await getServices();

  // Group by category
  const byCat: Record<string, any[]> = {};
  services.forEach(s => {
    if (!byCat[s.category]) byCat[s.category] = [];
    byCat[s.category].push(s);
  });
  const categories = Object.keys(byCat).map((name, i) => ({
    name, num: String(i + 1).padStart(2, '0'), services: byCat[name],
  }));

  return (
    <>
      <Nav />

      {/* HERO */}
      <section style={{ minHeight: '100vh', padding: '130px 24px 80px', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 60, alignItems: 'center' }} className="hero-grid">
        <div className="flower" style={{ top: '10%', right: '5%', width: 80, height: 80 }}>
          <FlowerSVG color="var(--gold)" opacity={0.5} />
        </div>
        <div className="flower" style={{ bottom: '8%', left: '3%', width: 60, height: 60, animationDelay: '-2s' }}>
          <FlowerSVG color="var(--rose)" opacity={0.4} />
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28, color: 'var(--gold)', fontSize: 12, fontWeight: 500, letterSpacing: '.06em' }}>
              <span style={{ width: 30, height: 1, background: 'var(--gold)' }} />
              Institut de beauté · Paris 12ᵉ
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.98, letterSpacing: '-.04em', fontWeight: 300, marginBottom: 20 }}>
              L'art de <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, color: 'var(--gold)', fontSize: '1.15em' }}>votre</span> beauté.
            </h1>
          </Reveal>
          <Reveal delay={220}>
            <p style={{ fontSize: 'clamp(16px, 1.3vw, 18px)', maxWidth: 480, color: 'var(--mute)', lineHeight: 1.55, marginBottom: 36 }}>
              Sourcils, regard, sourire. Des soins précis, signés par des mains expertes, dans un cadre confidentiel.
            </p>
          </Reveal>
          <Reveal delay={320}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 50 }}>
              <Link href="/book" className="btn btn-gold">
                Prendre rendez-vous <Icon n="arrow" s={14} />
              </Link>
              <Link href="/prices" className="btn btn-ghost">Voir les tarifs</Link>
            </div>
          </Reveal>
          <Reveal delay={420}>
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', paddingTop: 30, borderTop: '1px solid var(--line)' }}>
              <div><div style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-.03em', color: 'var(--gold)' }}>6 ans</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>d'expertise</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-.03em', color: 'var(--gold)' }}>2 400+</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>clientes</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-.03em', color: 'var(--gold)' }}>4.9 ★</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>Google</div></div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div style={{ position: 'relative', aspectRatio: '4/5', maxHeight: '75vh' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '200px 200px 24px 24px', overflow: 'hidden', boxShadow: '0 50px 120px -30px rgba(0,0,0,.6)', border: '1px solid var(--line)' }}>
              <img src={HERO_IMG} alt="Beauté Face Signature" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.95) contrast(1.02)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(15,13,12,.4) 100%)' }} />
            </div>
            <div style={{ position: 'absolute', top: '8%', left: '-14%', transform: 'rotate(-3deg)', background: 'rgba(15,13,12,.85)', backdropFilter: 'blur(14px)', border: '1px solid var(--line-2)', padding: '14px 18px', borderRadius: 14, zIndex: 3 }}>
              <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 500 }}>Nouveau</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Candelips ✿</div>
            </div>
            <div style={{ position: 'absolute', bottom: '18%', right: '-10%', transform: 'rotate(2deg)', background: 'rgba(15,13,12,.85)', backdropFilter: 'blur(14px)', border: '1px solid var(--line-2)', padding: '14px 18px', borderRadius: 14, zIndex: 3 }}>
              <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 500 }}>Avis Google</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>4.9 / 5 ★</div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* PRICES SECTION */}
      <section style={{ padding: 'clamp(70px,11vw,130px) 24px', background: 'var(--bg-2)', position: 'relative', overflow: 'hidden' }}>
        <div className="flower" style={{ top: '5%', right: '8%', width: 70, height: 70 }}><FlowerSVG color="var(--gold)" opacity={0.4} /></div>
        <div className="flower" style={{ top: '40%', left: '5%', width: 50, height: 50, animationDelay: '-3s' }}><FlowerSVG color="var(--rose)" opacity={0.35} /></div>
        <div className="flower" style={{ bottom: '8%', right: '6%', width: 60, height: 60, animationDelay: '-5s' }}><FlowerSVG color="var(--gold)" opacity={0.4} /></div>

        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 50, position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Carte</div>
            <h2 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 300, letterSpacing: '-.03em', lineHeight: 1.05, margin: 0 }}>
              Nos <em style={{ fontFamily: 'Dancing Script, cursive', fontStyle: 'normal', fontWeight: 600, color: 'var(--gold)', fontSize: '1.15em' }}>tarifs</em>.
            </h2>
            <p style={{ marginTop: 18, color: 'var(--mute)', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
              Prix nets, tout inclus. Cliquez sur un soin pour le réserver directement.
            </p>
          </div>
        </Reveal>

        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 60, position: 'relative', zIndex: 2 }}>
          {categories.map((c, i) => (
            <Reveal key={c.name} delay={i * 100}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, fontSize: 28, color: 'var(--gold)' }}>{c.num}</span>
                  <h3 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-.02em', margin: 0 }}>{c.name}</h3>
                </div>
                {c.services.map(s => (
                  <Link key={s.id} href={`/book?service=${s.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'baseline', padding: '14px 0', borderBottom: '1px dashed var(--line)', transition: 'all .2s', cursor: 'pointer' }}>
                    <div style={{ fontSize: 16, fontWeight: 400 }}>
                      {s.name}
                      {s.note && <small style={{ display: 'block', fontSize: 12.5, color: 'var(--mute)', marginTop: 3 }}>{s.note}</small>}
                    </div>
                    {s.old_price ? <div style={{ textDecoration: 'line-through', color: 'var(--mute)', fontSize: 14 }}>{s.old_price}€</div> : <div />}
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--gold)', letterSpacing: '-.01em' }}>{s.price}€</div>
                  </Link>
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 50, position: 'relative', zIndex: 2 }}>
          <Link href="/book" className="btn btn-gold">Réserver un soin <Icon n="arrow" s={14} /></Link>
        </div>
      </section>

      {/* LOCATION */}
      <section style={{ padding: 'clamp(70px,11vw,130px) 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Visite</div>
            <h2 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 300, letterSpacing: '-.03em', lineHeight: 1.05, margin: 0 }}>
              Nous <em style={{ fontFamily: 'Dancing Script, cursive', fontStyle: 'normal', fontWeight: 600, color: 'var(--gold)', fontSize: '1.15em' }}>trouver</em>.
            </h2>
          </div>
        </Reveal>
        <LocationBlock />
      </section>

      <Footer />
      <FabWA />

      <style>{`
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; padding-top: 110px !important; text-align: center; min-height: auto !important; }
        }
      `}</style>
    </>
  );
}

export function LocationBlock() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40 }} className="loc-grid">
      <Reveal>
        <div style={{ aspectRatio: '5/4', borderRadius: 18, overflow: 'hidden', position: 'relative', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2624.5!2d2.388!3d48.842!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDjCsDUwJzMxLjIiTiAywrAyMyczMS43IkU!5e0!3m2!1sfr!2sfr!4v1700000000000!5m2!1sfr!2sfr"
            width="100%" height="100%" style={{ border: 0, filter: 'grayscale(.3) contrast(1.05)' }}
            allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, padding: '30px 0' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--gold)' }}><Icon n="pin" s={18} /></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Adresse</div>
              <div style={{ fontSize: 18 }}>152 Rue de Charenton</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>75012 Paris</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--gold)' }}><Icon n="phone" s={18} /></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Téléphone</div>
              <div style={{ fontSize: 18 }}>+33 6 95 24 18 07</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>WhatsApp disponible</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--gold)' }}><Icon n="clock" s={18} /></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Horaires</div>
              <div style={{ fontSize: 18 }}>Lun — Sam : 10h — 19h</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>Dimanche sur rendez-vous</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-gold btn-sm" href="https://wa.me/33695241807" target="_blank" rel="noreferrer">WhatsApp <Icon n="wa" s={14} /></a>
            <a className="btn btn-ghost btn-sm" href="https://maps.google.com/?q=152+Rue+de+Charenton+75012+Paris" target="_blank" rel="noreferrer">Itinéraire <Icon n="arrow" s={14} /></a>
          </div>
        </div>
      </Reveal>

      <style>{`@media (max-width: 880px) { .loc-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
