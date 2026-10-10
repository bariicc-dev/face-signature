import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { BookingWizard } from './BookingWizard';
import { createClient } from '@/lib/supabase-server';
import { getDisplayServices } from '@/lib/services';

export default async function BookPage({ searchParams }: { searchParams: { service?: string } }) {
  const sb = createClient();
  const { data: services } = await sb.from('services').select('*').eq('active', true).order('sort_order');


  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-head">
          <div className="eyebrow">Réservation</div>
          <h1>Votre <em>rendez-vous</em>.</h1>
        </div>
        <BookingWizard
          services={getDisplayServices(services)}
          preselectId={searchParams.service}
        />
      </div>
      <Footer />
      <FabWA />
    </>
  );
}
