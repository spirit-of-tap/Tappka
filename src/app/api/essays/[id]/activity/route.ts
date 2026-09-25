import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayViewers, getEssayVoters } from '@/lib/essays/queries';
import { serverLogger } from '@/lib/server-logger';
import type { EssayViewerItem, EssayVoterItem } from '@/lib/essays/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .select('id, author_profile_id')
      .eq('id', id)
      .maybeSingle();

    if (essayError || !essay) {
      return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });
    }

    const isAuthor = essay.author_profile_id === profile.id;

    let views: EssayViewerItem[] = [];
    if (isAuthor) {
      try {
        views = await getEssayViewers(supabase, id);
      } catch (err) {
        serverLogger.console.error('Error fetching essay viewers:', err);
      }
    }

    let votes: EssayVoterItem[] = [];
    try {
      votes = await getEssayVoters(supabase, id);
    } catch (err) {
      serverLogger.console.error('Error fetching essay votes:', err);
    }

    return NextResponse.json({
      isAuthor,
      views,
      votes,
    });
  } catch (error) {
    serverLogger.console.error('GET /api/essays/[id]/activity error:', error);
    return NextResponse.json({ error: 'Chyba při načítání aktivity u eseje' }, { status: 500 });
  }
}
