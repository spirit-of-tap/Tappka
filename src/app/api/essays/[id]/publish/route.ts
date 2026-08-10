// src/app/api/essays/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const essay = await getEssayById(supabase, id);
    if (!essay || essay.author_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    if (!essay.title.trim()) {
      return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
    }
    if (!essay.content_text.trim()) {
      return NextResponse.json({ error: 'Obsah eseje je povinný' }, { status: 400 });
    }

    // Already published: publishing again would move published_at and reorder
    // the feed for no reason, so treat it as a no-op.
    if (essay.published_at != null) {
      return NextResponse.json({ data: essay });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('essays')
      .update({ published_at: now, updated_at: now, updated_by_profile_id: profile.id })
      .eq('id', id)
      .eq('author_profile_id', profile.id);

    if (updateError) throw updateError;

    const published = await getEssayById(supabase, id);
    return NextResponse.json({ data: published });
  } catch (error) {
    console.error('POST /api/essays/[id]/publish error:', error);
    return NextResponse.json({ error: 'Nepodařilo se zveřejnit esej' }, { status: 500 });
  }
}