import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats } from '@/lib/essays/queries';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { tagNamesFromJoin } from '@/lib/books/tags';

interface EssayRevisionRow {
  title: string;
  revision_no: number;
  invalid_since: string | null;
}

/**
 * Picks the latest non-invalid essay revision title.
 */
function latestRevisionTitle(revisions: EssayRevisionRow[] | null | undefined): string {
  const valid = (revisions ?? []).filter((r) => r.invalid_since == null);
  if (valid.length === 0) return '';
  return valid.reduce((best, row) => (row.revision_no > best.revision_no ? row : best)).title;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  const [essayData, stats] = await Promise.all([
    supabase
      .from('essays')
      .select(`
        id,
        essay_revisions(title, revision_no, invalid_since),
        book:books!book_id(
          id,
          title_cs,
          author,
          book_points,
          source,
          book_tags(tags(name))
        )
      `)
      .eq('author_profile_id', profile.id)
      .not('published_at', 'is', null)
      .is('removed_at', null)
      .not('book_id', 'is', null)
      .order('created_at', { ascending: true }),
    getUserBookPointsStats(supabase, profile.id),
  ]);

  if (essayData.error) throw essayData.error;

  const rows = (essayData.data ?? []).map((essay, i) => {
    const rawBook = Array.isArray(essay.book) ? essay.book[0] : essay.book;
    const book = rawBook as {
      id: string;
      title_cs: string;
      author: string;
      book_points: number | null;
      source: string;
      book_tags?: { tags: { name: string } | null }[] | null;
    } | null;
    const tags = tagNamesFromJoin(book?.book_tags);
    const firstTag = tags[0] ?? '';
    const category = BOOK_CATEGORY_LABELS[firstTag] ?? firstTag;
    const revisions = essay.essay_revisions as EssayRevisionRow[] | null;

    return {
      index: i + 1,
      bookTitle: book?.title_cs ?? '',
      author: book?.author ?? '',
      essayId: essay.id,
      essayTitle: latestRevisionTitle(revisions),
      category,
      source: 'Kniha',
      points: Number(book?.book_points ?? 0),
    };
  });

  return NextResponse.json({
    rows,
    stats: {
      approvedPoints: stats.approved_points,
      pendingPoints: stats.pending_points,
      essayCount: stats.essay_count,
    },
  });
}
