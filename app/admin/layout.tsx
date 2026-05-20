import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Admin — Face Signature',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  // Allow login page through
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {children}
    </div>
  );
}
