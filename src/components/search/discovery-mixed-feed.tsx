'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2, RotateCw } from 'lucide-react';

import { FeedBookCard, type BookEssayItem } from '@/components/books/feed-book-card';
import { SocialEssayFeedCard, type AuthorGamificationStats } from '@/components/essays/social-essay-feed-card';
import { AlsoWroteCard } from '@/components/books/also-wrote-card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { getDailySeed } from '@/lib/feed/daily-seed';
import {
  buildScrollkySegment,
  collectShownIds,
  getScrollkyItemKey,
  type ScrollkyEssay,
  type ScrollkyItem,
} from '@/lib/feed/scrollky';
import type { BookWithProfiles } from '@/lib/books/types';

export type EssayWithVoted = ScrollkyEssay;
export type MixedFeedItem = ScrollkyItem;

/** Start loading the next batch this far before the sentinel scrolls into view. */
const PREFETCH_ROOT_MARGIN = '600px';

interface ScrollkyBatchResponse {
  books?: BookWithProfiles[];
  essays?: ScrollkyEssay[];
  essaysByBookId?: Record<string, BookEssayItem[]>;
  hasMore?: boolean;
}

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
  /** Viewer id — only the author sees their frozen (locked) points; others see live book points. */
  currentProfileId?: string | null;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export function DiscoveryMixedFeed({
  books,
  libraryBookIds = [],
  recentEssays,
  popularEssays,
  teamEssays = [],
  essaysByBookId: initialEssaysByBookId = {},
  teamNamesById = {},
  authorStatsById = {},
  userTeamId,
  currentProfileId,
}: DiscoveryMixedFeedProps) {
  // Daily seed: stable within a day, rotates at local midnight.
  const [feedSeed] = useState(() => getDailySeed());
  const viewer = useMemo(
    () => ({ profileId: currentProfileId, teamId: userTeamId }),
    [currentProfileId, userTeamId],
  );

  const initialPool = useMemo(
    () => dedupeById([...teamEssays, ...popularEssays, ...recentEssays]),
    [teamEssays, popularEssays, recentEssays],
  );
  const popularEssayIds = useMemo(() => popularEssays.map((e) => e.id), [popularEssays]);

  const firstSegment = useMemo(
    () =>
      buildScrollkySegment({
        books,
        essays: initialPool,
        essayPool: initialPool,
        popularEssayIds,
        viewer,
        seed: feedSeed,
        segmentIndex: 0,
      }),
    [books, initialPool, popularEssayIds, viewer, feedSeed],
  );

  // Later batches are appended as their own segments and never reshuffled,
  // so cards the viewer already scrolled past stay where they were.
  const [extraItems, setExtraItems] = useState<ScrollkyItem[]>([]);
  const [extraPool, setExtraPool] = useState<ScrollkyEssay[]>([]);
  const [extraEssaysByBookId, setExtraEssaysByBookId] = useState<Record<string, BookEssayItem[]>>({});
  const [batch, setBatch] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const feedItems = useMemo(() => [...firstSegment, ...extraItems], [firstSegment, extraItems]);
  const librarySet = useMemo(() => new Set(libraryBookIds), [libraryBookIds]);
  const mergedEssaysByBookId = useMemo(
    () => ({ ...initialEssaysByBookId, ...extraEssaysByBookId }),
    [initialEssaysByBookId, extraEssaysByBookId],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setLoadFailed(false);

    try {
      const nextBatch = batch + 1;
      const res = await fetch(`/api/scrollky?batch=${nextBatch}`);
      if (!res.ok) throw new Error(`Scrollky batch failed: ${res.status}`);
      const data = (await res.json()) as ScrollkyBatchResponse;

      const shown = collectShownIds(feedItems);
      const newBooks = (data.books ?? []).filter((b) => !shown.bookIds.has(b.id));
      const newEssays = (data.essays ?? []).filter((e) => !shown.essayIds.has(e.id));
      const pool = dedupeById([...initialPool, ...extraPool, ...newEssays]);

      const segment = buildScrollkySegment({
        books: newBooks,
        essays: newEssays,
        essayPool: pool,
        popularEssayIds,
        viewer,
        seed: feedSeed,
        segmentIndex: nextBatch,
      });

      setExtraItems((prev) => [...prev, ...segment]);
      setExtraPool((prev) => [...prev, ...newEssays]);
      setExtraEssaysByBookId((prev) => ({ ...prev, ...(data.essaysByBookId ?? {}) }));
      setBatch(nextBatch);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Error loading more scrollky posts:', err);
      setLoadFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, batch, feedItems, initialPool, extraPool, popularEssayIds, viewer, feedSeed]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadFailed || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: PREFETCH_ROOT_MARGIN },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loadFailed]);

  return (
    <section className="space-y-4 pt-1">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Scrollky</h2>
        <p className="text-xs text-muted-foreground">
          Ověřené knihy a reflexe komunity. Nahoře je to, co je pro tebe nové.
        </p>
      </div>

      {feedItems.length > 0 ? (
        <div className="space-y-4">
          {feedItems.map((item) => {
            const key = getScrollkyItemKey(item);

            if (item.type === 'book') {
              return (
                <FeedBookCard
                  key={key}
                  book={item.data}
                  essays={mergedEssaysByBookId[item.data.id] ?? []}
                  inLibrary={librarySet.has(item.data.id)}
                />
              );
            }

            if (item.type === 'multi_perspective') {
              return (
                <AlsoWroteCard key={key} book={item.book} essays={item.essays} teamNamesById={teamNamesById} />
              );
            }

            return (
              <SocialEssayFeedCard
                key={key}
                essay={item.data}
                initialVoted={item.data.user_has_voted ?? false}
                isViewed={item.data.user_has_viewed ?? false}
                teamName={item.data.author?.team_id ? teamNamesById[item.data.author.team_id] : null}
                authorStats={item.data.author?.id ? authorStatsById[item.data.author.id] : null}
                reason={item.reason}
                currentProfileId={currentProfileId}
              />
            );
          })}
        </div>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>Zatím tu nic není</EmptyTitle>
            <EmptyDescription>Jakmile přibudou ověřené knihy a reflexe, objeví se tady.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-4">
        {isLoadingMore ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Načítám další inspiraci…</span>
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <span>Další příspěvky se nepodařilo načíst.</span>
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              <RotateCw className="size-3.5" />
              Zkusit znovu
            </Button>
          </div>
        ) : !hasMore && feedItems.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            Pro dnešek je to všechno. Zítra Scrollky zamícháme znovu.
          </p>
        ) : null}
      </div>
    </section>
  );
}
