import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { AdminDashboard } from './AdminDashboard';
import { getDisplayServices } from '@/lib/services';

export default async function AdminPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Load all bookings + services
  const [{ data: bookings }, { data: services }, { data: periods, error: periodsError }] = await Promise.all([
    sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false }),
    sb.from('services').select('*').order('sort_order'),
    sb.from('blocked_periods').select('*').order('starts_at'),
  ]);

  return <AdminDashboard user={user} initialBookings={bookings || []} services={getDisplayServices(services)} initialBlockedPeriods={periods || []} schedulingError={periodsError ? 'Les absences ne peuvent pas être chargées. Vérifiez que la mise à jour Supabase a été appliquée.' : undefined} />;
}
