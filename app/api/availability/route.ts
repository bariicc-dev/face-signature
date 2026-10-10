import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { parisDayRange } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || '';
  let range: ReturnType<typeof parisDayRange>;
  try { range = parisDayRange(date); }
  catch { return NextResponse.json({ error: 'Date invalide.' }, { status: 400 }); }

  // The RPC exposes anonymous time ranges only, never client details or absence labels.
  const { data, error } = await createClient().rpc('get_booking_availability', { p_from: range.from, p_until: range.until });
  if (error) {
    console.error('Availability unavailable:', error);
    return NextResponse.json({ error: 'Les disponibilités sont momentanément indisponibles. Veuillez réessayer.' }, { status: 503 });
  }
  return NextResponse.json({ windows: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}
