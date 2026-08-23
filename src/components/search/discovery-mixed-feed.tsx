'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { FeedBookCard, type BookEssayItem } from '@/components/books/feed-book-card';
import { SocialEssayFeedCard, type AuthorGamificationStats } from '@/components/essays/social-essay-feed-card';
import { AlsoWroteCard } from '@/components/books/also-wrote-card';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';
import type { BookWithProfiles } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

export type EssayWithVoted = EssayWithDetails & { user_has_voted?: boolean };

export type MixedFeedItem =
  | { type: 'book'; data: BookWithProfiles }
  | { type: 'essay'; data: EssayWithVoted; spotlightLabel?: string }
  | { type: 'also_wrote'; book: BookWithProfiles; essays: EssayWithVoted[] };

export interface DiscoveryMixedFeedProps {
  books: BookWithProfiles[];
  libraryBookIds?: string[];
  recentEssays: EssayWithVoted[];
  popularEssays: EssayWithVoted[];
  teamEssays?: EssayWithVoted[];
  essaysByBookId?: Record<string, BookEssayItem[]>;
  teamNamesById?: Record<string, string>;
  authorStatsById?: Record<string, AuthorGamificationStats>;
  userTeamName?: string | null;
  userTeamId?: string | null;
}

// Deterministic pseudo-random number generator (Mulberry32)
function createPrng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(array: T[], prng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function DiscoveryMixedFeed({
  books: initialBooks,
  libraryBookIds = [],
  recentEssays: initialRecentEssays,
  popularEssays,
  teamEssays = [],
  essaysByBookId: initialEssaysByBookId = {},
  teamNamesById = {},
  authorStatsById = {},
}: DiscoveryMixedFeedProps) {
  const [feedSeed] = usePersistedState<number>('tappka:scrollky:seed', 42, {
    storage: 'sessionStorage',
  });

  // Infinite scroll state
  const [extraBooks, setExtraBooks] = useState<BookWithProfiles[]>([]);
  const [extraEssays, setExtraEssays] = useState<EssayWithVoted[]>([]);
  const [extraEssaysByBookId, setExtraEssaysByBookId] = useState<Record<string, BookEssayItem[]>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const librarySet = useMemo(() => new Set(libraryBookIds), [libraryBookIds]);

  const allBooks = useMemo(() => {
    const seen = new Set<string>();
    const combined: BookWithProfiles[] = [];
    for (const b of [...initialBooks, ...extraBooks]) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        combined.push(b);
      }
    }
    return combined;
  }, [initialBooks, extraBooks]);

  const allRecentEssays = useMemo(() => {
    const seen = new Set<string>();
    const combined: EssayWithVoted[] = [];
    for (const e of [...initialRecentEssays, ...extraEssays]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        combined.push(e);
      }
    }
    return combined;
  }, [initialRecentEssays, extraEssays]);

  const mergedEssaysByBookId = useMemo(() => {
    return { ...initialEssaysByBookId, ...extraEssaysByBookId };
  }, [initialEssaysByBookId, extraEssaysByBookId]);

  // Load next page automatically from /api/scrollky
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/scrollky?page=${nextPage}&pageSize=15`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      if (data.books?.length || data.essays?.length) {
        setExtraBooks((prev) => [...prev, ...(data.books ?? [])]);
        setExtraEssays((prev) => [...prev, ...(data.essays ?? [])]);
        setExtraEssaysByBookId((prev) => ({ ...prev, ...(data.essaysByBookId ?? {}) }));
        setPage(nextPage);
      }
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Error loading more scrollky posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page]);

  // Attach IntersectionObserver to sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  const feedItems = useMemo<MixedFeedItem[]>(() => {
    const prng = createPrng(feedSeed);

    // Filter strictly to Shortlist books with >= 2 essays
    const shortlistVerifiedBooks = allBooks.filter(
      (b) => b.list_status === 'shortlist' && (b.essay_count ?? 0) >= 2,
    );
    const selectedBooks = shuffleArray(shortlistVerifiedBooks, prng);

    // Group essays by book for "Taky napsali" cross-perspectives
    const essaysByBookMap = new Map<string, EssayWithVoted[]>();
    const allEssaysPool = [...teamEssays, ...popularEssays, ...allRecentEssays];
    for (const essay of allEssaysPool) {
      if (!essay.book_id) continue;
      const list = essaysByBookMap.get(essay.book_id) ?? [];
      if (!list.some((e) => e.id === essay.id)) {
        list.push(essay);
        essaysByBookMap.set(essay.book_id, list);
      }
    }

    const spotlightEssays = shuffleArray(popularEssays.slice(0, 8), prng).slice(0, 4);
    const standardEssays = shuffleArray(allRecentEssays, prng);

    // Interleave evenly: 1 Book -> 1 Essay (standard or spotlight) -> 1 "Taky napsali" / Book...
    const result: MixedFeedItem[] = [];
    let bookIdx = 0;
    let standardEssayIdx = 0;
    let spotlightIdx = 0;
    const usedAlsoWroteBookIds = new Set<string>();

    const totalAvailable = selectedBooks.length + standardEssays.length + spotlightEssays.length;

    while (result.length < totalAvailable) {
      // Check if we should insert a "Taky napsali" card (every ~5 items)
      if (result.length > 0 && result.length % 5 === 0 && bookIdx < selectedBooks.length) {
        const candidateBook = selectedBooks[bookIdx];
        const loadedEssays = essaysByBookMap.get(candidateBook.id) ?? [];
        if (loadedEssays.length >= 2 && !usedAlsoWroteBookIds.has(candidateBook.id)) {
          usedAlsoWroteBookIds.add(candidateBook.id);
          result.push({
            type: 'also_wrote',
            book: candidateBook,
            essays: loadedEssays,
          });
          bookIdx++;
          continue;
        }
      }

      // 1. Add Book if available
      if (bookIdx < selectedBooks.length) {
        result.push({ type: 'book', data: selectedBooks[bookIdx] });
        bookIdx++;
      }

      // 2. Add Essay if available (alternating spotlight and standard)
      if (spotlightIdx < spotlightEssays.length && (result.length % 3 === 1)) {
        result.push({
          type: 'essay',
          data: spotlightEssays[spotlightIdx],
          spotlightLabel: 'Nejčtenější reflexe týdne',
        });
        spotlightIdx++;
      } else if (standardEssayIdx < standardEssays.length) {
        result.push({
          type: 'essay',
          data: standardEssays[standardEssayIdx],
        });
        standardEssayIdx++;
      } else if (spotlightIdx < spotlightEssays.length) {
        result.push({
          type: 'essay',
          data: spotlightEssays[spotlightIdx],
          spotlightLabel: 'Populární esej',
        });
        spotlightIdx++;
      }

      // If we made no progress in this loop iteration, break
      if (
        bookIdx >= selectedBooks.length &&
        standardEssayIdx >= standardEssays.length &&
        spotlightIdx >= spotlightEssays.length
      ) {
        break;
      }
    }

    return result;
  }, [feedSeed, allBooks, popularEssays, allRecentEssays, teamEssays]);

  return (
    <section className="space-y-4 pt-1">
      {/* Stream Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Scrollky</h2>
          <p className="text-xs text-muted-foreground">
            Proud ověřených knih a komunitních reflexí pro každodenní inspiraci.
          </p>
        </div>
      </div>

      {/* Interleaved Mixed Stream */}
      {feedItems.length > 0 ? (
        <div className="space-y-4">
          {feedItems.map((item, index) => {
            if (item.type === 'book') {
              const inLib = librarySet.has(item.data.id);
              const essays = mergedEssaysByBookId[item.data.id] ?? [];
              return (
                <FeedBookCard
                  key={`book-${item.data.id}-${index}`}
                  book={item.data}
                  essays={essays}
                  inLibrary={inLib}
                />
              );
            }

            if (item.type === 'also_wrote') {
              return (
                <AlsoWroteCard
                  key={`also-wrote-${item.book.id}-${index}`}
                  book={item.book}
                  essays={item.essays}
                  teamNamesById={teamNamesById}
                />
              );
            }

            return (
              <SocialEssayFeedCard
                key={`essay-${item.data.id}-${index}`}
                essay={item.data}
                initialVoted={item.data.user_has_voted ?? false}
                teamName={item.data.author?.team_id ? teamNamesById[item.data.author.team_id] : null}
                authorStats={item.data.author?.id ? authorStatsById[item.data.author.id] : null}
                spotlightLabel={item.spotlightLabel}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground space-y-2">
          <BookOpen className="size-8 mx-auto text-muted-foreground/40" />
          <p>Zatím zde nejsou žádné položky k zobrazení.</p>
        </div>
      )}

      {/* Infinite Scroll Sentinel & Loader */}
      <div ref={sentinelRef} className="py-4 flex items-center justify-center min-h-[40px]">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Načítám další inspiraci...</span>
          </div>
        )}
      </div>
    </section>
  );
}
