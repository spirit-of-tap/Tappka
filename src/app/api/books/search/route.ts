import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBooks } from '@/lib/books/queries';
import { getBookIdsInLibrary } from '@/lib/library/book-ids';

const SEARCH_RESULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return NextResponse.json({ data: [] });

    // No listStatus/listStatuses filter — search spans every status, matching
    // the add-book duplicate check and library import's "does it already
    // exist in the catalog" use case.
    const results = await getBooks(supabase, { search: q, pageSize: SEARCH_RESULT_LIMIT });

    if (results.length === 0) return NextResponse.json({ data: [] });

    const inLibrary = await getBookIdsInLibrary(supabase, results.map((b) => b.id));
    const enriched = results.map((book) => ({ ...book, in_library: inLibrary.has(book.id) }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('GET /api/books/search error:', error);
    return NextResponse.json({ error: 'Hledání selhalo' }, { status: 500 });
  }
}
