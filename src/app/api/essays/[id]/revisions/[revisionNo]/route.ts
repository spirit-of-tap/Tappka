import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';

interface RouteContext {
  params: Promise<{ id: string; revisionNo: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, revisionNo } = await params;
    const parsedNo = Number(revisionNo);
    if (!Number.isInteger(parsedNo) || parsedNo < 1) {
      return NextResponse.json({ error: 'Neplatná verze' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .select('id')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (essayError) throw essayError;
    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });

    const { data, error } = await supabase
      .from('essay_revisions')
      .select('revision_no, title, content_json')
      .eq('essay_id', id)
      .eq('revision_no', parsedNo)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('GET /api/essays/[id]/revisions/[revisionNo] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst verzi' }, { status: 500 });
  }
}