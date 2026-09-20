import { resolveEssayPoints } from '@/lib/books/points';
import type { EssayWithDetails } from './types';

export interface EssaySourceDisplay {
  /** 'legacy': a frozen pre-cutover essay whose old-system book was never linked/imported — earns points but has no title/author to show. */
  kind: 'book' | 'content_source' | 'legacy' | 'none';
  title: string | null;
  author: string | null;
  points: number;
  /** True when `points` is zeroed by archival — never true for a frozen essay, since archival can't touch a frozen value. */
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
 *
 * Frozen values are author-private credit: pass
 * `{ viewerCanSeeFrozen: false }` on public surfaces (essay detail for
 * non-authors, discovery feed, other profiles) so visitors see the book's
 * live points instead of someone else's locked value. Authors (and coaches
 * in review) keep the default `true` and see the lock.
 */
export interface EssaySourceDisplayOptions {
  viewerCanSeeFrozen?: boolean;
}

export function getEssaySourceDisplay(
  essay: Pick<EssayWithDetails, 'book' | 'content_source' | 'frozen_book_points'>,
  options?: EssaySourceDisplayOptions,
): EssaySourceDisplay {
  const viewerCanSeeFrozen = options?.viewerCanSeeFrozen ?? true;

  // Public view: a frozen value belongs to the author, not the visitor.
  // Show the book's live score so the essay badge matches the book detail.
  // A frozen essay with no linked book has no live value — report 'none'
  // so visitors see no points rather than a misleading 0.
  if (!viewerCanSeeFrozen && essay.frozen_book_points != null) {
    if (essay.book) {
      return {
        kind: 'book',
        title: essay.book.title_cs,
        author: essay.book.author,
        points: resolveEssayPoints({ book: essay.book }),
        isArchived: essay.book.list_status === 'archived',
        isFrozen: false,
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

  if (essay.book) {
    return {
      kind: 'book',
      title: essay.book.title_cs,
      author: essay.book.author,
      points: resolveEssayPoints({ frozenBookPoints: essay.frozen_book_points, book: essay.book }),
      isArchived: essay.book.list_status === 'archived' && essay.frozen_book_points == null,
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

  // No book or content source linked at all. A frozen essay can still land
  // here — some legacy essays reference an old-system book that was never
  // imported into the catalog — so its points still count, just with
  // nothing real to show as a title/author.
  if (essay.frozen_book_points != null) {
    return {
      kind: 'legacy',
      title: 'Esej ze starého systému',
      author: null,
      points: resolveEssayPoints({ frozenBookPoints: essay.frozen_book_points }),
      isArchived: false,
      isFrozen: true,
      illustrationKind: null,
    };
  }

  return { kind: 'none', title: null, author: null, points: 0, isArchived: false, isFrozen: false, illustrationKind: null };
}
