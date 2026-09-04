import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getBooks } from '@/lib/books/queries';
import { getContentSources } from '@/lib/content-sources/queries';
import { serverLogger } from "@/lib/server-logger";

/** Capped per kind so a broad query still returns in one round trip. */
const RESULT_LIMIT = 10;

/**
 * Single search across both things an essay can be about — books and
 * content sources — for the essay editor's picker. One round trip instead
 * of two, and skips per-book enrichment (like `/api/books/search`'s
 * library-copy lookup) that this picker never needed.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return NextResponse.json({ data: { books: [], sources: [] } });

    const [books, sources] = await Promise.all([
      getBooks(supabase, { search: q, pageSize: RESULT_LIMIT }),
      getContentSources(supabase, { search: q, pageSize: RESULT_LIMIT }),
    ]);

    return NextResponse.json({ data: { books, sources } });
  } catch (error) {
    serverLogger.console.error('GET /api/essays/source-search error:', error);
    return NextResponse.json({ error: 'Hledání selhalo' }, { status: 500 });
  }
}
