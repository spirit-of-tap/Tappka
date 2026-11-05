import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { serverLogger } from '@/lib/server-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase
      .from('book_wishlist')
      .upsert(
        { profile_id: profile.id, book_id: id },
        { onConflict: 'profile_id,book_id', ignoreDuplicates: true },
      );

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });
      }
      serverLogger.console.error('POST book wishlist error:', error);
      return NextResponse.json({ error: 'Knihu se nepodařilo uložit' }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    serverLogger.console.error('POST /api/books/[id]/wishlist error:', error);
    return NextResponse.json({ error: 'Knihu se nepodařilo uložit' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase
      .from('book_wishlist')
      .delete()
      .eq('profile_id', profile.id)
      .eq('book_id', id);

    if (error) {
      serverLogger.console.error('DELETE book wishlist error:', error);
      return NextResponse.json({ error: 'Knihu se nepodařilo odebrat' }, { status: 500 });
    }

    return NextResponse.json({ saved: false });
  } catch (error) {
    serverLogger.console.error('DELETE /api/books/[id]/wishlist error:', error);
    return NextResponse.json({ error: 'Knihu se nepodařilo odebrat' }, { status: 500 });
  }
}
