import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBooks } from '@/lib/books/queries';
import { getEssays } from '@/lib/essays/queries';
import type { BookEssayItem } from '@/components/books/feed-book-card';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(30, Math.max(5, parseInt(searchParams.get('pageSize') ?? '15', 10)));

    // Fetch next batch of shortlist verified books and recent essays via SQL
    const [books, essays] = await Promise.all([
      getBooks(supabase, {
        listStatus: 'shortlist',
        minEssayCount: 2,
        sortBy: 'popular',
        page,
        pageSize,
      }),
      getEssays(supabase, {
        sort: 'recent',
        page,
        pageSize,
      }),
    ]);

    // Check user votes on essays
    const essayIds = essays.map((e) => e.id);
    const votedSet = new Set<string>();
    if (profile && essayIds.length > 0) {
      const { data: votes } = await supabase
        .from('essay_votes')
        .select('essay_id')
        .eq('voter_profile_id', profile.id)
        .in('essay_id', essayIds);
      votes?.forEach((v: { essay_id: string }) => votedSet.add(v.essay_id));
    }

    const annotatedEssays = essays.map((e) => ({
      ...e,
      user_has_voted: votedSet.has(e.id),
    }));

    // Build essays by book mapping
    const essaysByBookId: Record<string, BookEssayItem[]> = {};
    for (const essay of essays) {
      if (!essay.book_id) continue;
      const list = (essaysByBookId[essay.book_id] ??= []);
      if (list.length < 4 && !list.some((item) => item.id === essay.id)) {
        list.push({
          id: essay.id,
          title: essay.title,
          author: essay.author
            ? {
                id: essay.author.id,
                name: essay.author.name,
                picture: essay.author.picture,
                team_id: essay.author.team_id,
              }
            : null,
        });
      }
    }

    const hasMore = books.length >= pageSize || essays.length >= pageSize;

    return NextResponse.json({
      books,
      essays: annotatedEssays,
      essaysByBookId,
      hasMore,
    });
  } catch (error) {
    console.error('Failed to load scrollky feed batch:', error);
    return NextResponse.json(
      { error: 'Chyba při načítání feedu' },
      { status: 500 },
    );
  }
}
