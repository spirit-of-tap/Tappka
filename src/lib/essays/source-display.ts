import { resolveEssayPoints } from '@/lib/books/points';
import type { EssayWithDetails } from './types';

export interface EssaySourceDisplay {
  kind: 'book' | 'content_source' | 'none';
  title: string | null;
  author: string | null;
  points: number;
  isArchived: boolean;
  /** True when `points` came from `frozen_book_points` rather than the live value. */
  isFrozen: boolean;
  /** Non-null only for a content source — drives which icon tile to render. */
  illustrationKind: string | null;
}

/**
 * Single place that branches on `essay.book` vs `essay.content_source` so
 * every renderer (card, editor header, delete dialog) reads one shape —
 * including resolving `frozen_book_points` vs the live `book_points`
 * (see `resolveEssayPoints`), so no consumer needs to duplicate that logic.
 */
export function getEssaySourceDisplay(
  essay: Pick<EssayWithDetails, 'book' | 'content_source' | 'frozen_book_points'>,
): EssaySourceDisplay {
  if (essay.book) {
    return {
      kind: 'book',
      title: essay.book.title_cs,
      author: essay.book.author,
      points: resolveEssayPoints({ frozenBookPoints: essay.frozen_book_points, book: essay.book }),
      isArchived: essay.book.list_status === 'archived',
      isFrozen: essay.frozen_book_points != null,
      illustrationKind: null,
    };
  }

  if (essay.content_source) {
    return {
      kind: 'content_source',
      title: essay.content_source.title,
      author: essay.content_source.creator,
      points: resolveEssayPoints({ contentSource: essay.content_source }),
      isArchived: essay.content_source.status === 'archived',
      isFrozen: false,
      illustrationKind: essay.content_source.kind,
    };
  }

  return { kind: 'none', title: null, author: null, points: 0, isArchived: false, isFrozen: false, illustrationKind: null };
}
