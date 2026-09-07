import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { refetchGoogleBookData } from '@/lib/books/external/google-books';
import { serverLogger } from '@/lib/server-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const isCoachOrAdmin = profile.role === 'coach' || profile.role === 'admin';
    if (!isCoachOrAdmin) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const book = await getBookById(supabase, id);
    if (!book) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

    const body: { title?: string; author?: string; isbn_13?: string } =
      await request.json().catch(() => ({}));

    const title = body.title?.trim() || book.title_cs;
    const author = body.author?.trim() || book.author;
    const isbn = body.isbn_13?.trim() || book.isbn_13;

    const candidate = await refetchGoogleBookData({
      externalId: book.source === 'google_books' ? book.external_id : null,
      isbn,
      title,
      author,
    });

    if (!candidate) {
      return NextResponse.json({
        data: null,
        error: 'Kniha nebyla na Google Books nalezena',
      });
    }

    return NextResponse.json({
      data: {
        cover_url: candidate.cover_url,
        preview_link: candidate.preview_link,
        isbn_13: candidate.isbn_13,
        page_count: candidate.page_count,
        external_id: candidate.external_id,
      },
    });
  } catch (error) {
    serverLogger.console.error('POST /api/books/[id]/google-refetch error:', error);
    return NextResponse.json({ error: 'Nepodařilo se dohledat data na Google Books' }, { status: 500 });
  }
}
