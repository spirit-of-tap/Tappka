import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getMyLoans } from '@/lib/library/queries';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const loans = await getMyLoans(supabase, profile.id);

    return NextResponse.json({ data: loans });
  } catch (error) {
    console.error('GET /api/library/loans/my error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst výpůjčky' }, { status: 500 });
  }
}
