import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getLibraryBooks, getBooksWithLibraryInfo } from '@/lib/library/queries';
import type { LibraryBookResult } from '@/lib/library/types';
import { serverLogger } from "@/lib/server-logger";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('book_id') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const pageSize = searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined;

    const libraryBooks = await getLibraryBooks(supabase, { bookId, page, pageSize });

    if (libraryBooks.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const bookIds = libraryBooks.map((lb) => lb.book_id);
    const libraryInfoMap = await getBooksWithLibraryInfo(supabase, bookIds);

    const data: LibraryBookResult[] = libraryBooks.map((lb) => {
      const info = libraryInfoMap.get(lb.book_id) ?? { totalCopies: 0, availableCopies: 0, inLibrary: false };
      return {
        id: lb.id,
        book_id: lb.book_id,
        created_at: lb.created_at,
        book: lb.book,
        totalCopies: info.totalCopies,
        availableCopies: info.availableCopies,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    serverLogger.console.error('GET /api/library/books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst knihovnu' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body: { book_id: string } = await request.json();

    if (!body.book_id?.trim()) {
      return NextResponse.json({ error: 'ID knihy je povinné' }, { status: 400 });
    }

    const { data: libraryBook, error } = await supabase
      .from('library_books')
      .insert({
        book_id: body.book_id.trim(),
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: libraryBook }, { status: 201 });
  } catch (error) {
    serverLogger.console.error('POST /api/library/books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat knihu do knihovny' }, { status: 500 });
  }
}
