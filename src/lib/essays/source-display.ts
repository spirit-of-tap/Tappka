import { pointsNumber } from '@/lib/books/points';
import type { EssayWithDetails } from './types';

export interface EssaySourceDisplay {
  kind: 'book' | 'content_source' | 'none';
  title: string | null;
  author: string | null;
  points: number;
  isArchived: boolean;
  /** Non-null only for a content source — drives which icon tile to render. */
  illustrationKind: string | null;
}

/**
 * Single place that branches on `essay.book` vs `essay.content_source` so
 * every renderer (card, editor header, delete dialog) reads one shape.
 */
export function getEssaySourceDisplay(
  essay: Pick<EssayWithDetails, 'book' | 'content_source'>,
): EssaySourceDisplay {
  if (essay.book) {
    return {
      kind: 'book',
      title: essay.book.title_cs,
      author: essay.book.author,
      points: pointsNumber(essay.book.book_points),
      isArchived: essay.book.list_status === 'archived',
      illustrationKind: null,
    };
  }

  if (essay.content_source) {
    return {
      kind: 'content_source',
      title: essay.content_source.title,
      author: essay.content_source.creator,
      points: pointsNumber(essay.content_source.points),
      isArchived: essay.content_source.status === 'archived',
      illustrationKind: essay.content_source.kind,
    };
  }

  return { kind: 'none', title: null, author: null, points: 0, isArchived: false, illustrationKind: null };
}
