import Link from 'next/link';
import { Icon, FlowerSVG } from '@/components/Icon';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { createClient } from '@/lib/supabase-server';
import { Reveal } from '@/components/Reveal';

const HERO_IMAGE = {
  src: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1100&q=82',
  alt: 'Soin esthétique premium en institut',
};

const MAIN_SERVICES = ['Sourcils', 'Candelips', 'Eyeliner', 'Cils', 'Blanchiment'];
const TRUST_ITEMS = [
  { title: 'Aucun paiement en ligne', text: 'La réservation se confirme, le règlement se fait à l\'institut.' },
  { title: 'Confirmation par email', text: 'La cliente reçoit son récapitulatif après la demande.' },
  { title: 'Paris 12e', text: '152 Rue de Charenton, accessible et facile à retrouver.' },
  { title: 'WhatsApp direct', text: 'Une question avant de réserver ? Réponse simple et rapide.' },
];

async function getServices() {
  const sb = createClient();
  const { data } = await sb.from('services').select('*').eq('active', true).order('sort_order');
  return data || [];
}

export default async function Home() {
  const services = await getServices();

  const byCat: Record<string, any[]> = {};
  services.forEach(s => {
    if (!byCat[s.category]) byCat[s.category] = [];
    byCat[s.category].push(s);
  });
  const categories = Object.keys(byCat).map((name, i) => ({
    name,
    num: String(i + 1).padStart(2, '0'),
    services: byCat[name],
  }));

  return (
    <>
      <Nav />

      <section style={{ minHeight: 'calc(100vh - 20px)', padding: '132px 24px 58px', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0,1.02fr) minmax(320px,.98fr)', gap: 58, alignItems: 'center' }} className="hero-grid">
        <div className="flower" style={{ top: '12%', right: '6%', width: 72, height: 72 }}>
          <FlowerSVG color="var(--gold)" opacity={0.34} />
        </div>
        <div className="flower" style={{ bottom: '8%', left: '4%', width: 54, height: 54, animationDelay: '-2s' }}>
          <FlowerSVG color="var(--rose)" opacity={0.26} />
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 24, color: 'var(--gold)', fontSize: 12, fontWeight: 500, letterSpacing: '.06em' }}>
              <span style={{ width: 30, height: 1, background: 'var(--gold)' }} />
              Institut de beauté · Paris 12e
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 style={{ fontSize: 'clamp(44px, 7.5vw, 88px)', lineHeight: 1, letterSpacing: 0, fontWeight: 300, margin: '0 0 20px' }}>
              Beauté du regard, des lèvres et du sourire.
            </h1>
          </Reveal>
          <Reveal delay={190}>
            <p style={{ fontSize: 'clamp(16px, 1.3vw, 18px)', maxWidth: 540, color: 'var(--mute)', lineHeight: 1.6, margin: '0 0 24px' }}>
              Face Signature accompagne vos sourcils, candelips, eyeliner, cils et blanchiment dans un cadre calme, précis et féminin à Paris 12e.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 30 }}>
              {MAIN_SERVICES.map(service => <span key={service} className="service-chip">{service}</span>)}
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 38 }}>
              <Link href="/book" className="btn btn-gold">
                Prendre rendez-vous <Icon n="arrow" s={14} />
              </Link>
              <Link href="/prices" className="btn btn-ghost">Voir les tarifs</Link>
            </div>
          </Reveal>
          <Reveal delay={410}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, paddingTop: 24, borderTop: '1px solid var(--line)' }} className="hero-proof">
              <div><div style={{ fontSize: 22, fontWeight: 300, color: 'var(--gold)' }}>Expertise</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>soins pigmentaires</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 300, color: 'var(--gold)' }}>Adresse claire</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>Paris 12e</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 300, color: 'var(--gold)' }}>Suivi simple</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>email + WhatsApp</div></div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={180}>
          <div style={{ position: 'relative', aspectRatio: '4/5', maxHeight: '74vh', minHeight: 420 }} className="hero-image-wrap">
            <div style={{ position: 'absolute', inset: 0, borderRadius: '190px 190px 24px 24px', overflow: 'hidden', boxShadow: '0 50px 120px -34px rgba(0,0,0,.72)', border: '1px solid var(--line)' }}>
              <img src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.9) contrast(1.03)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,13,12,.02) 42%, rgba(15,13,12,.52) 100%)' }} />
            </div>
            <div style={{ position: 'absolute', top: '8%', left: '-10%', background: 'rgba(15,13,12,.84)', backdropFilter: 'blur(14px)', border: '1px solid var(--line-2)', padding: '14px 18px', borderRadius: 14, zIndex: 3 }} className="hero-card-note">
              <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 500 }}>Spécialité</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Sourcils · Lèvres · Regard</div>
            </div>
            <div style={{ position: 'absolute', bottom: '14%', right: '-8%', background: 'rgba(15,13,12,.84)', backdropFilter: 'blur(14px)', border: '1px solid var(--line-2)', padding: '14px 18px', borderRadius: 14, zIndex: 3 }} className="hero-card-note">
              <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 500 }}>Réservation</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Simple, sans paiement immédiat</div>
            </div>
          </div>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 84px', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="trust-grid">
          {TRUST_ITEMS.map(item => (
            <div className="trust-item" key={item.title}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(201,165,114,.14)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon n="check" s={13} /></div>
              <div><strong>{item.title}</strong><span>{item.text}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: 'clamp(70px,10vw,120px) 24px', background: 'var(--bg-2)', position: 'relative', overflow: 'hidden' }}>
        <div className="flower" style={{ top: '6%', right: '8%', width: 64, height: 64 }}><FlowerSVG color="var(--gold)" opacity={0.28} /></div>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 46, position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Carte</div>
            <h2 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 300, letterSpacing: 0, lineHeight: 1.05, margin: 0 }}>
              Choisir son <em style={{ fontFamily: 'Dancing Script, cursive', fontStyle: 'normal', fontWeight: 600, color: 'var(--gold)', fontSize: '1.15em' }}>soin</em>.
            </h2>
            <p style={{ marginTop: 18, color: 'var(--mute)', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              Des tarifs lisibles, une action de réservation directe, et aucun paiement demandé en ligne.
            </p>
          </div>
        </Reveal>

        <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 52, position: 'relative', zIndex: 2 }}>
          {categories.slice(0, 3).map((c, i) => (
            <Reveal key={c.name} delay={i * 90}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, fontSize: 28, color: 'var(--gold)' }}>{c.num}</span>
                  <h3 style={{ fontSize: 28, fontWeight: 300, letterSpacing: 0, margin: 0 }}>{c.name}</h3>
                </div>
                {c.services.slice(0, 5).map(s => (
                  <Link key={s.id} href={`/book?service=${s.id}`} className="price-row">
                    <div>
                      <span className="price-name">{s.name}</span>
                      {s.note && <small className="price-note">{s.note}</small>}
                    </div>
                    <span className="price-duration">{s.duration} min</span>
                    <span>{s.old_price ? <span className="old-price">{s.old_price}€</span> : null}</span>
                    <span className="new-price">{s.price}€</span>
                    <span className="book-label">Réserver</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48, position: 'relative', zIndex: 2 }}>
          <Link href="/prices" className="btn btn-ghost">Voir toute la carte</Link>
        </div>
      </section>

      <section style={{ padding: 'clamp(70px,10vw,120px) 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 46 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Visite</div>
            <h2 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 300, letterSpacing: 0, lineHeight: 1.05, margin: 0 }}>
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
          .hero-grid { grid-template-columns: 1fr !important; gap: 34px !important; padding: 108px 18px 44px !important; min-height: auto !important; }
          .hero-proof { grid-template-columns: 1fr !important; }
          .hero-image-wrap { min-height: 340px !important; max-height: none !important; }
          .hero-card-note { left: 12px !important; right: 12px !important; transform: none !important; }
          .hero-card-note:last-child { bottom: 12px !important; }
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
            title="Carte Face Signature, 152 Rue de Charenton, Paris 12e"
          />
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, padding: '30px 0' }}>
          <InfoLine icon="pin" label="Adresse" main="152 Rue de Charenton" sub="75012 Paris" />
          <InfoLine icon="phone" label="Téléphone" main="+33 6 95 24 18 07" sub="WhatsApp disponible" />
          <InfoLine icon="clock" label="Horaires" main="Lun - Sam : 10h - 19h" sub="Dimanche sur rendez-vous" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-gold btn-sm" href="https://wa.me/33695241807?text=Bonjour%20Face%20Signature%2C%20je%20souhaite%20un%20renseignement." target="_blank" rel="noreferrer">WhatsApp <Icon n="wa" s={14} /></a>
            <a className="btn btn-ghost btn-sm" href="https://maps.google.com/?q=152+Rue+de+Charenton+75012+Paris" target="_blank" rel="noreferrer">Itinéraire <Icon n="arrow" s={14} /></a>
          </div>
        </div>
      </Reveal>

      <style>{`@media (max-width: 880px) { .loc-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function InfoLine({ icon, label, main, sub }: { icon: string; label: string; main: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--gold)' }}><Icon n={icon} s={18} /></div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 18 }}>{main}</div>
        <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}
