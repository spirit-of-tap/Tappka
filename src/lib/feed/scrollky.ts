import type { BookWithProfiles } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

/** Books loaded server-side for the first Scrollky segment. Must be a multiple of the batch size. */
export const SCROLLKY_INITIAL_BOOK_COUNT = 60;
/** Recent essays loaded server-side for the first segment. Must be a multiple of the batch size. */
export const SCROLLKY_INITIAL_ESSAY_COUNT = 40;
/** Books and essays fetched per infinite-scroll batch from `/api/scrollky`. */
export const SCROLLKY_BATCH_SIZE = 20;
/** Only verified books (shortlist with at least this many essays) appear in Scrollky. */
export const SCROLLKY_MIN_BOOK_ESSAYS = 2;

/** Insert a "Další pohledy" card at most every N items. */
const MULTI_PERSPECTIVE_INTERVAL = 6;
/** Essays that follow each book card. Essays are the social part of the feed. */
const ESSAYS_PER_BOOK = 2;
/** Most-voted essays of the month that can carry the "popular" label. */
const POPULAR_POOL_SIZE = 8;
/** Cap the "popular" label per segment so it keeps meaning something. */
const MAX_POPULAR_LABELS_PER_SEGMENT = 3;
const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Seed offset between segments so each batch gets its own (still deterministic) shuffle. */
const SEGMENT_SEED_STRIDE = 7919;

/**
 * Essay ranking weights. Unseen dominates so anything the viewer already
 * opened or liked sinks below all new content; the rest only reorders
 * within those two groups. Jitter keeps the daily order from feeling static.
 */
const ESSAY_SCORE = {
  unseen: 10,
  team: 1.2,
  fresh: 0.8,
  popular: 0.6,
  jitter: 1,
} as const;

export type ScrollkyEssay = EssayWithDetails & {
  user_has_voted?: boolean;
  user_has_viewed?: boolean;
};

export type ScrollkyEssayReason = 'team' | 'popular';

export type ScrollkyItem =
  | { type: 'book'; data: BookWithProfiles }
  | { type: 'essay'; data: ScrollkyEssay; reason?: ScrollkyEssayReason }
  | { type: 'multi_perspective'; book: BookWithProfiles; essays: ScrollkyEssay[] };

export interface ScrollkyViewer {
  profileId?: string | null;
  teamId?: string | null;
}

export interface ScrollkySegmentInput {
  /** Book candidates for this segment; ones already shown must be filtered out by the caller. */
  books: BookWithProfiles[];
  /** Essay candidates for this segment; ones already shown must be filtered out by the caller. */
  essays: ScrollkyEssay[];
  /** All essays known so far, used to find books with several perspectives. */
  essayPool: ScrollkyEssay[];
  /** Month's most-voted essays, best first. */
  popularEssayIds?: string[];
  viewer?: ScrollkyViewer;
  seed: number;
  segmentIndex: number;
  now?: number;
}

/**
 * The API page for the `batch`-th extra batch (1-based). Initial counts are
 * multiples of the batch size, so batches start right after the server load
 * instead of re-fetching rows the viewer already has.
 */
export function getScrollkyBatchPage(initialCount: number, batch: number): number {
  return initialCount / SCROLLKY_BATCH_SIZE + batch;
}

// Deterministic pseudo-random number generator (Mulberry32)
export function createPrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(array: T[], prng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isScrollkyBook(book: BookWithProfiles): boolean {
  return book.list_status === 'shortlist' && (book.essay_count ?? 0) >= SCROLLKY_MIN_BOOK_ESSAYS;
}

export function isEssaySeen(essay: ScrollkyEssay): boolean {
  return Boolean(essay.user_has_viewed || essay.user_has_voted);
}

function isOwnEssay(essay: ScrollkyEssay, viewer: ScrollkyViewer): boolean {
  return viewer.profileId != null && essay.author_profile_id === viewer.profileId;
}

function isTeammateEssay(essay: ScrollkyEssay, viewer: ScrollkyViewer): boolean {
  return viewer.teamId != null && essay.author?.team_id === viewer.teamId;
}

function isFreshEssay(essay: ScrollkyEssay, now: number): boolean {
  const ts = new Date(essay.published_at ?? essay.created_at).getTime();
  return now - ts >= 0 && now - ts <= FRESH_WINDOW_MS;
}

interface RankedEssay {
  essay: ScrollkyEssay;
  reason?: ScrollkyEssayReason;
}

/** Ranks essays for one segment: unseen first, then teammates, fresh and popular, with daily jitter. */
export function rankScrollkyEssays(
  essays: ScrollkyEssay[],
  {
    viewer = {},
    popularEssayIds = [],
    prng,
    now = Date.now(),
  }: { viewer?: ScrollkyViewer; popularEssayIds?: string[]; prng: () => number; now?: number },
): RankedEssay[] {
  const popularSet = new Set(popularEssayIds.slice(0, POPULAR_POOL_SIZE));

  const scored = essays
    .filter((essay) => !isOwnEssay(essay, viewer))
    .map((essay) => {
      const unseen = !isEssaySeen(essay);
      const team = isTeammateEssay(essay, viewer);
      const popular = popularSet.has(essay.id) && essay.vote_count > 0;
      const score =
        (unseen ? ESSAY_SCORE.unseen : 0) +
        (team ? ESSAY_SCORE.team : 0) +
        (isFreshEssay(essay, now) ? ESSAY_SCORE.fresh : 0) +
        (popular ? ESSAY_SCORE.popular : 0) +
        prng() * ESSAY_SCORE.jitter;
      return { essay, score, unseen, team, popular };
    })
    .sort((a, b) => b.score - a.score);

  let popularLabels = 0;
  return scored.map(({ essay, unseen, team, popular }) => {
    if (!unseen) return { essay };
    if (team) return { essay, reason: 'team' };
    if (popular && popularLabels < MAX_POPULAR_LABELS_PER_SEGMENT) {
      popularLabels++;
      return { essay, reason: 'popular' };
    }
    return { essay };
  });
}

function groupEssaysByBook(pool: ScrollkyEssay[], viewer: ScrollkyViewer): Map<string, ScrollkyEssay[]> {
  const byBook = new Map<string, ScrollkyEssay[]>();
  const seen = new Set<string>();
  for (const essay of pool) {
    if (!essay.book_id || seen.has(essay.id) || isOwnEssay(essay, viewer)) continue;
    seen.add(essay.id);
    const list = byBook.get(essay.book_id) ?? [];
    list.push(essay);
    byBook.set(essay.book_id, list);
  }
  return byBook;
}

/**
 * Builds one self-contained Scrollky segment. Segments are appended, never
 * rebuilt, so cards the viewer already scrolled past keep their place when
 * the next batch arrives.
 */
export function buildScrollkySegment({
  books,
  essays,
  essayPool,
  popularEssayIds,
  viewer = {},
  seed,
  segmentIndex,
  now = Date.now(),
}: ScrollkySegmentInput): ScrollkyItem[] {
  const prng = createPrng(seed + segmentIndex * SEGMENT_SEED_STRIDE);
  const orderedBooks = shuffleArray(books.filter(isScrollkyBook), prng);
  const rankedEssays = rankScrollkyEssays(essays, { viewer, popularEssayIds, prng, now });
  const essaysByBook = groupEssaysByBook(essayPool, viewer);

  const result: ScrollkyItem[] = [];
  let bookIdx = 0;
  let essayIdx = 0;
  let sinceMultiPerspective = 0;

  while (bookIdx < orderedBooks.length || essayIdx < rankedEssays.length) {
    if (bookIdx < orderedBooks.length) {
      const book = orderedBooks[bookIdx++];
      const perspectives = essaysByBook.get(book.id) ?? [];
      if (sinceMultiPerspective >= MULTI_PERSPECTIVE_INTERVAL && perspectives.length >= SCROLLKY_MIN_BOOK_ESSAYS) {
        result.push({ type: 'multi_perspective', book, essays: perspectives });
        sinceMultiPerspective = 0;
      } else {
        result.push({ type: 'book', data: book });
        sinceMultiPerspective++;
      }
    }

    for (let i = 0; i < ESSAYS_PER_BOOK && essayIdx < rankedEssays.length; i++) {
      const { essay, reason } = rankedEssays[essayIdx++];
      result.push(reason ? { type: 'essay', data: essay, reason } : { type: 'essay', data: essay });
      sinceMultiPerspective++;
    }
  }

  return result;
}

export function getScrollkyItemKey(item: ScrollkyItem): string {
  if (item.type === 'essay') return `essay-${item.data.id}`;
  if (item.type === 'book') return `book-${item.data.id}`;
  return `multi-${item.book.id}`;
}

/** Ids already placed in the feed, so later batches only add new cards. */
export function collectShownIds(items: ScrollkyItem[]): { bookIds: Set<string>; essayIds: Set<string> } {
  const bookIds = new Set<string>();
  const essayIds = new Set<string>();
  for (const item of items) {
    if (item.type === 'essay') essayIds.add(item.data.id);
    else if (item.type === 'book') bookIds.add(item.data.id);
    else bookIds.add(item.book.id);
  }
  return { bookIds, essayIds };
}
