import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats } from '@/lib/essays/queries';
import { resolveEssayPoints } from '@/lib/books/points';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { tagNamesFromJoin } from '@/lib/books/tags';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSourceKind } from '@/lib/content-sources/types';

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

interface PortfolioContentSourceRow {
  id: string;
  kind: ContentSourceKind;
  title: string;
  creator: string | null;
  points: number | string | null;
}

/** PostgREST returns a to-one embed as an object, but types it as possibly an array. */
function firstEmbed<T>(embed: T | T[] | null | undefined): T | null {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
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
        frozen_book_points,
        essay_revisions(title, revision_no, invalid_since),
        book:books!book_id(
          id,
          title_cs,
          author,
          book_points,
          list_status,
          source,
          book_tags(tags(name))
        ),
        content_source:content_sources!content_source_id(
          id,
          kind,
          title,
          creator,
          points
        )
      `)
      .eq('author_profile_id', profile.id)
      .not('published_at', 'is', null)
      .is('removed_at', null)
      // Every essay that carries a source, book or otherwise — an essay with
      // neither is "nad rámec četby" and has nothing to itemize.
      .or('book_id.not.is.null,content_source_id.not.is.null')
      .order('created_at', { ascending: true }),
    getUserBookPointsStats(supabase, profile.id),
  ]);

  if (essayData.error) throw essayData.error;

  const rows = (essayData.data ?? []).map((essay, i) => {
    const book = firstEmbed(essay.book) as {
      id: string;
      title_cs: string;
      author: string;
      book_points: number | null;
      list_status: string;
      source: string;
      book_tags?: { tags: { name: string } | null }[] | null;
    } | null;
    const contentSource = firstEmbed(essay.content_source) as PortfolioContentSourceRow | null;
    const tags = tagNamesFromJoin(book?.book_tags);
    const firstTag = tags[0] ?? '';
    const category = BOOK_CATEGORY_LABELS[firstTag] ?? firstTag;
    const revisions = essay.essay_revisions as EssayRevisionRow[] | null;

    return {
      index: i + 1,
      bookTitle: book?.title_cs ?? contentSource?.title ?? '',
      author: book?.author ?? contentSource?.creator ?? '',
      essayId: essay.id,
      essayTitle: latestRevisionTitle(revisions),
      category,
      source: book ? 'Kniha' : contentSource ? CONTENT_SOURCE_KIND_LABELS[contentSource.kind] : '',
      points: resolveEssayPoints({ frozenBookPoints: essay.frozen_book_points, book, contentSource }),
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
