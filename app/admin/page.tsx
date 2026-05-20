import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { AdminDashboard } from './AdminDashboard';

export default async function AdminPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Load all bookings + services
  const [{ data: bookings }, { data: services }] = await Promise.all([
    sb.from('bookings').select('*, services(*)').order('appointment_at', { ascending: false }),
    sb.from('services').select('*').order('sort_order'),
  ]);

  return <AdminDashboard user={user} initialBookings={bookings || []} services={services || []} />;
}
