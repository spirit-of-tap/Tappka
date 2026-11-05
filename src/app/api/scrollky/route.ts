import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBooks } from '@/lib/books/queries';
import { getEssays } from '@/lib/essays/queries';
import { getFallbackBookEssays, mergeBookEssayMaps, toBookEssayPreview } from '@/lib/essays/book-essay-lists';
import { annotateViewerFlags, getViewerEssayFlags } from '@/lib/essays/viewer-flags';
import {
  SCROLLKY_BATCH_SIZE,
  SCROLLKY_INITIAL_BOOK_COUNT,
  SCROLLKY_INITIAL_ESSAY_COUNT,
  SCROLLKY_MIN_BOOK_ESSAYS,
  getScrollkyBatchPage,
} from '@/lib/feed/scrollky';
import type { BookEssayItem } from '@/components/books/feed-book-card';
import { serverLogger } from '@/lib/server-logger';

const MAX_ESSAYS_PER_BOOK_PREVIEW = 4;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) {
      return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    const { searchParams } = new URL(request.url);
    // 1-based count of batches after the server-rendered first segment.
    const batch = Math.max(1, parseInt(searchParams.get('batch') ?? '1', 10) || 1);

    const [books, essays] = await Promise.all([
      getBooks(supabase, {
        listStatus: 'shortlist',
        minEssayCount: SCROLLKY_MIN_BOOK_ESSAYS,
        sortBy: 'popular',
        page: getScrollkyBatchPage(SCROLLKY_INITIAL_BOOK_COUNT, batch),
        pageSize: SCROLLKY_BATCH_SIZE,
      }),
      getEssays(supabase, {
        sort: 'recent',
        page: getScrollkyBatchPage(SCROLLKY_INITIAL_ESSAY_COUNT, batch),
        pageSize: SCROLLKY_BATCH_SIZE,
      }),
    ]);

    const flags = await getViewerEssayFlags(supabase, profile?.id, essays.map((e) => e.id));

    const essaysByBookId: Record<string, BookEssayItem[]> = {};
    for (const essay of essays) {
      if (!essay.book_id) continue;
      const list = (essaysByBookId[essay.book_id] ??= []);
      if (list.length < MAX_ESSAYS_PER_BOOK_PREVIEW && !list.some((item) => item.id === essay.id)) {
        list.push(toBookEssayPreview(essay));
      }
    }

    // Books missed by this essay page would wrongly render "Zatím bez eseje".
    const booksMissingEssays = books.filter(
      (book) => (essaysByBookId[book.id] ?? []).length === 0 && (book.essay_count ?? 0) > 0,
    );
    const fallbackEssaysByBookId = await getFallbackBookEssays(
      supabase,
      booksMissingEssays.map((book) => book.id),
    );

    return NextResponse.json({
      books,
      essays: annotateViewerFlags(essays, flags),
      essaysByBookId: mergeBookEssayMaps(essaysByBookId, fallbackEssaysByBookId),
      hasMore: books.length >= SCROLLKY_BATCH_SIZE || essays.length >= SCROLLKY_BATCH_SIZE,
    });
  } catch (error) {
    serverLogger.console.error('Failed to load scrollky feed batch:', error);
    return NextResponse.json({ error: 'Chyba při načítání feedu' }, { status: 500 });
  }
}
