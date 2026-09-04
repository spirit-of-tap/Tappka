import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayRevisions } from '@/lib/essays/queries';
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data: essay, error } = await supabase
      .from('essays')
      .select('id')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (error) throw error;
    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });

    return NextResponse.json({ data: await getEssayRevisions(supabase, id) });
  } catch (error) {
    serverLogger.console.error('GET /api/essays/[id]/revisions error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst historii' }, { status: 500 });
  }
}