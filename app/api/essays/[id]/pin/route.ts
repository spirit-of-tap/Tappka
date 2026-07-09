import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';

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

    const { data: essay } = await supabase
      .from('essays')
      .select('author_profile_id, is_pinned, pinned_at')
      .eq('id', id)
      .single();

    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });
    if (essay.author_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const toggle = !essay.is_pinned;

    const { error } = await supabase
      .from('essays')
      .update({ is_pinned: toggle, pinned_at: toggle ? now : null })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ data: { is_pinned: toggle } });
  } catch (error) {
    console.error('POST /api/essays/[id]/pin error:', error);
    return NextResponse.json({ error: 'Nepodařilo se změnit připnutí' }, { status: 500 });
  }
}