import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { searchCatalogBooks, type CatalogSearchBook } from '@/lib/books/catalog-search';
import { createClient } from '@/lib/supabase/server';
import { serverLogger } from "@/lib/server-logger";

const SEARCH_RESULT_LIMIT = 10;
const CATALOG_COLUMNS = 'id, title_cs, title_en, author, isbn_13, google_books_cover_url';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (!query) return NextResponse.json({ data: [] });

    const { data, error } = await supabase
      .from('books')
      .select(CATALOG_COLUMNS);

    if (error) throw error;

    const results = searchCatalogBooks(
      (data ?? []) as CatalogSearchBook[],
      query,
      SEARCH_RESULT_LIMIT,
    );
    return NextResponse.json({ data: results });
  } catch (error) {
    serverLogger.console.error('GET /api/library/catalog-search error:', error);
    return NextResponse.json({ error: 'Hledání selhalo' }, { status: 500 });
  }
}
