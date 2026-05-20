import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FabWA } from '@/components/FabWA';
import { BookingWizard } from './BookingWizard';
import { createClient } from '@/lib/supabase-server';

export default async function BookPage({ searchParams }: { searchParams: { service?: string } }) {
  const sb = createClient();
  const { data: services } = await sb.from('services').select('*').eq('active', true).order('sort_order');

  // Pull busy slots for the next 60 days
  const now = new Date();
  const sixtyDays = new Date(now); sixtyDays.setDate(sixtyDays.getDate() + 60);
  const { data: busy } = await sb
    .from('bookings')
    .select('appointment_at, duration, status')
    .gte('appointment_at', now.toISOString())
    .lte('appointment_at', sixtyDays.toISOString())
    .neq('status', 'cancelled');

  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-head">
          <div className="eyebrow">Réservation</div>
          <h1>Votre <em>rendez-vous</em>.</h1>
        </div>
        <BookingWizard
          services={services || []}
          busy={busy || []}
          preselectId={searchParams.service}
        />
      </div>
      <Footer />
      <FabWA />
    </>
  );
}
