import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { serverLogger } from "@/lib/server-logger";

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
      .select('author_profile_id, pinned_at, removed_at')
      .eq('id', id)
      .maybeSingle();

    if (!essay || essay.removed_at != null) {
      return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });
    }
    if (essay.author_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const currentlyPinned = essay.pinned_at != null;
    const nextPinnedAt = currentlyPinned ? null : now;
    const nextPinnedBy = currentlyPinned ? null : profile.id;

    const { error } = await supabase
      .from('essays')
      .update({
        pinned_at: nextPinnedAt,
        pinned_by_profile_id: nextPinnedBy,
        updated_by_profile_id: profile.id,
        updated_at: now,
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      data: {
        pinned_at: nextPinnedAt,
        pinned_by_profile_id: nextPinnedBy,
      },
    });
  } catch (error) {
    serverLogger.console.error('POST /api/essays/[id]/pin error:', error);
    return NextResponse.json({ error: 'Nepodařilo se změnit připnutí' }, { status: 500 });
  }
}
