import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { notifyEssayCoachRead } from '@/lib/notifications/essay-notifications';
import { serverLogger } from "@/lib/server-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_coach_reads')
      .upsert(
        {
          essay_id: id,
          coach_profile_id: profile.id,
          created_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        },
        { onConflict: 'essay_id,coach_profile_id', ignoreDuplicates: true },
      )
      .select('essay_id');

    if (error) {
      if (error.code === '42501' || error.message?.includes('policy')) {
        return NextResponse.json({ error: 'Nelze označit tuto esej' }, { status: 403 });
      }
      serverLogger.console.error('POST coach-read error:', error);
      return NextResponse.json({ error: 'Chyba při označení' }, { status: 500 });
    }

    if (data && data.length > 0) {
      after(() => {
        notifyEssayCoachRead(supabase, {
          essayId: id,
          actorProfileId: profile.id,
          origin: new URL(request.url).origin,
        }).catch((err) => serverLogger.console.error('notifyEssayCoachRead failed:', err));
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    serverLogger.console.error('POST /api/essays/[id]/coach-read error:', error);
    return NextResponse.json({ error: 'Chyba při označení' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase
      .from('essay_coach_reads')
      .delete()
      .eq('essay_id', id)
      .eq('coach_profile_id', profile.id);

    if (error) {
      serverLogger.console.error('DELETE coach-read error:', error);
      return NextResponse.json({ error: 'Chyba při odznačení' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    serverLogger.console.error('DELETE /api/essays/[id]/coach-read error:', error);
    return NextResponse.json({ error: 'Chyba při odznačení' }, { status: 500 });
  }
}
