'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCheck,
  Clock,
  CornerDownRight,
  FilePenLine,
  Inbox,
  MessageCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { CoachReadButton } from './coach-read-button';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';

import { pointsNumber } from '@/lib/books/points';
import type {
  CoachReviewEssay,
  CoachReviewPointsFilter,
  CoachReviewReplyFilter,
  CoachReviewRocketFilter,
  EssayCoachReadWithProfile,
  EssayCommentWithAuthor,
} from '@/lib/essays/types';

interface CoachReviewListProps {
  initialUnread?: CoachReviewEssay[];
  initialRead?: CoachReviewEssay[];
  initialUnreadCount?: number;
  initialReadCount?: number;
  initialHasMore?: boolean;
  teams?: { id: string; name: string }[];
  defaultTeamId?: string;
  authorPointsMap?: Record<string, number>;
  commentsMap?: Record<string, EssayCommentWithAuthor[]>;
  coachCommentsMap?: Record<string, EssayCommentWithAuthor[]>;
  coachReadsMap?: Record<string, EssayCoachReadWithProfile[]>;
  currentCoachId?: string;
  currentCoachName?: string;
}

export function CoachReviewList({
  initialUnread = [],
  initialRead = [],
  initialUnreadCount,
  initialReadCount,
  initialHasMore = false,
  teams = [],
  defaultTeamId = 'all',
  authorPointsMap: _initialAuthorPointsMap = {},
  commentsMap: initialCommentsMap = {},
  coachCommentsMap = {},
  coachReadsMap: initialCoachReadsMap = {},
  currentCoachId,
  currentCoachName = 'Kouč:ka',
}: CoachReviewListProps) {
  const [activeTab, setActiveTab] = usePersistedState<'unread' | 'read'>(
    'tappka:coach-review:tab',
    'unread',
  );
  const [teamFilter, setTeamFilter] = usePersistedState<string>(
    'tappka:coach-review:team',
    defaultTeamId,
  );
  const [rocketFilter, setRocketFilter] = usePersistedState<CoachReviewRocketFilter>(
    'tappka:coach-review:rocket',
    'all',
  );
  const [pointsFilter, setPointsFilter] = usePersistedState<CoachReviewPointsFilter>(
    'tappka:coach-review:points',
    'all',
  );
  const [replyFilter, setReplyFilter] = usePersistedState<CoachReviewReplyFilter>(
    'tappka:coach-review:reply',
    'all',
  );

  const initialFilterEssay = useCallback(
    (essay: CoachReviewEssay) => {
      if (defaultTeamId !== 'all') {
        if (essay.author?.team_id !== defaultTeamId) return false;
      }
      return true;
    },
    [defaultTeamId],
  );

  const [essays, setEssays] = useState<CoachReviewEssay[]>(() => {
    const list = activeTab === 'unread' ? initialUnread : initialRead;
    return defaultTeamId === 'all' ? list : list.filter(initialFilterEssay);
  });

  const [unreadCount, setUnreadCount] = useState<number>(() => {
    if (initialUnreadCount !== undefined) return initialUnreadCount;
    return defaultTeamId === 'all'
      ? initialUnread.length
      : initialUnread.filter(initialFilterEssay).length;
  });

  const [readCount, setReadCount] = useState<number>(() => {
    if (initialReadCount !== undefined) return initialReadCount;
    return defaultTeamId === 'all'
      ? initialRead.length
      : initialRead.filter(initialFilterEssay).length;
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [commentsMap, setCommentsMap] =
    useState<Record<string, EssayCommentWithAuthor[]>>(initialCommentsMap);
  const [readsMap, setReadsMap] =
    useState<Record<string, EssayCoachReadWithProfile[]>>(initialCoachReadsMap);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const effectiveCommentsMap = useMemo(() => {
    const merged: Record<string, EssayCommentWithAuthor[]> = { ...commentsMap };
    for (const [essayId, coachComments] of Object.entries(coachCommentsMap)) {
      const existing = merged[essayId] ?? [];
      const existingIds = new Set(existing.map((c) => c.id));
      const newCoach = coachComments.filter((c) => !existingIds.has(c.id));
      merged[essayId] = [...existing, ...newCoach];
    }
    return merged;
  }, [commentsMap, coachCommentsMap]);

  const hasActiveFilters =
    teamFilter !== defaultTeamId ||
    rocketFilter !== 'all' ||
    pointsFilter !== 'all' ||
    replyFilter !== 'all';

  const resetFilters = () => {
    setTeamFilter(defaultTeamId);
    setRocketFilter('all');
    setPointsFilter('all');
    setReplyFilter('all');
  };

  const buildUrl = useCallback(
    (tab: string, pageNum: number) => {
      const params = new URLSearchParams({
        tab,
        page: String(pageNum),
        page_size: '50',
      });
      if (teamFilter) params.set('team_id', teamFilter);
      if (rocketFilter !== 'all') params.set('rocket', rocketFilter);
      if (pointsFilter !== 'all') params.set('points', pointsFilter);
      if (replyFilter !== 'all') params.set('reply', replyFilter);
      return `/api/essays/coach-review?${params.toString()}`;
    },
    [teamFilter, rocketFilter, pointsFilter, replyFilter],
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const isDefault =
        activeTab === 'unread' &&
        teamFilter === defaultTeamId &&
        rocketFilter === 'all' &&
        pointsFilter === 'all' &&
        replyFilter === 'all';
      if (isDefault) return;
    }

    let isCancelled = false;
    async function fetchFiltered() {
      setLoading(true);
      try {
        const res = await fetch(buildUrl(activeTab, 1));
        if (!res.ok) throw new Error('Fetch failed');
        const json = await res.json();
        if (isCancelled) return;
        setEssays(json.data ?? []);
        setUnreadCount(json.unreadCount ?? 0);
        setReadCount(json.readCount ?? 0);
        setHasMore(json.hasMore ?? false);
        setPage(1);
        if (json.commentsMap) setCommentsMap((prev) => ({ ...prev, ...json.commentsMap }));
        if (json.coachReadsMap) setReadsMap((prev) => ({ ...prev, ...json.coachReadsMap }));
      } catch (err) {
        console.error('Failed to fetch filtered essays:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchFiltered();
    return () => {
      isCancelled = true;
    };
  }, [activeTab, teamFilter, rocketFilter, pointsFilter, replyFilter, defaultTeamId, buildUrl]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(buildUrl(activeTab, nextPage));
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      const newItems = (json.data ?? []) as CoachReviewEssay[];
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setEssays((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const toAdd = newItems.filter((e) => !existingIds.has(e.id));
          return [...prev, ...toAdd];
        });
        setPage(nextPage);
        setHasMore(json.hasMore ?? false);
        if (json.commentsMap) setCommentsMap((prev) => ({ ...prev, ...json.commentsMap }));
        if (json.coachReadsMap) setReadsMap((prev) => ({ ...prev, ...json.coachReadsMap }));
      }
    } catch (err) {
      console.error('Failed to load more essays:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, buildUrl, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const markRead = (essay: CoachReviewEssay) => {
    if (activeTab === 'unread') {
      setEssays((prev) => prev.filter((e) => e.id !== essay.id));
    }
    setUnreadCount((c) => Math.max(0, c - 1));
    setReadCount((c) => c + 1);
    if (currentCoachId) {
      const newEntry: EssayCoachReadWithProfile = {
        essay_id: essay.id,
        coach_profile_id: currentCoachId,
        read_at: new Date().toISOString(),
        coach: { id: currentCoachId, name: currentCoachName, picture: null, role: 'coach' },
      };
      setReadsMap((prev) => ({
        ...prev,
        [essay.id]: [
          ...(prev[essay.id]?.filter((r) => r.coach_profile_id !== currentCoachId) ?? []),
          newEntry,
        ],
      }));
    }
  };

  const markUnread = (essay: CoachReviewEssay) => {
    if (activeTab === 'read') {
      setEssays((prev) => prev.filter((e) => e.id !== essay.id));
    }
    setReadCount((c) => Math.max(0, c - 1));
    setUnreadCount((c) => c + 1);
    if (currentCoachId) {
      setReadsMap((prev) => {
        const existing = prev[essay.id] ?? [];
        return {
          ...prev,
          [essay.id]: existing.filter((r) => r.coach_profile_id !== currentCoachId),
        };
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {teams.length > 0 && (
          <div className="w-[150px] sm:w-[170px]">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Tým" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny týmy</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="w-[140px] sm:w-[160px]">
          <Select
            value={rocketFilter}
            onValueChange={(v) => setRocketFilter(v as CoachReviewRocketFilter)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Rocket model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny knihy</SelectItem>
              <SelectItem value="rocket">Pouze Rocket model</SelectItem>
              <SelectItem value="non-rocket">Mimo Rocket model</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[130px] sm:w-[150px]">
          <Select
            value={pointsFilter}
            onValueChange={(v) => setPointsFilter(v as CoachReviewPointsFilter)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Knižní body" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny body</SelectItem>
              <SelectItem value="1">1 bod</SelectItem>
              <SelectItem value="2">2 body</SelectItem>
              <SelectItem value="3">3 body</SelectItem>
              <SelectItem value="0">Bez bodů / Téma</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[160px] sm:w-[185px]">
          <Select
            value={replyFilter}
            onValueChange={(v) => setReplyFilter(v as CoachReviewReplyFilter)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Reakce Téčka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny reakce</SelectItem>
              <SelectItem value="with-reply">Téčko odpovědělo</SelectItem>
              <SelectItem value="without-reply">Bez odpovědi Téčka</SelectItem>
              <SelectItem value="edited-after-comment">Upraveno po komentáři</SelectItem>
              <SelectItem value="no-coach-comment">Bez komentáře kouče</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Resetovat filtry
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'unread' | 'read')}>
        <TabsList>
          <TabsTrigger value="unread">
            <Inbox />
            Nepřečtené
            <TabsTriggerCount count={unreadCount} tone="attention" />
          </TabsTrigger>
          <TabsTrigger value="read">
            <CheckCheck />
            Přečtené
            <TabsTriggerCount count={readCount} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : essays.length === 0 ? (
            <EmptyState
              label={
                hasActiveFilters
                  ? 'Žádné nepřečtené eseje neodpovídají zvoleným filtrům'
                  : 'Žádné nové eseje ke kontrole'
              }
              onReset={hasActiveFilters ? resetFilters : undefined}
            />
          ) : (
            <div className="space-y-3">
              {essays.map((essay) => (
                <ReviewRow
                  key={essay.id}
                  essay={essay}
                  read={false}
                  comments={effectiveCommentsMap[essay.id] ?? []}
                  coachReads={readsMap[essay.id] ?? []}
                  onToggled={() => markRead(essay)}
                />
              ))}
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Spinner className="size-5" />}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="read" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : essays.length === 0 ? (
            <EmptyState
              label={
                hasActiveFilters
                  ? 'Žádné přečtené eseje neodpovídají zvoleným filtrům'
                  : 'Zatím nemáš nic označené jako přečtené'
              }
              onReset={hasActiveFilters ? resetFilters : undefined}
            />
          ) : (
            <div className="space-y-3">
              {essays.map((essay) => (
                <ReviewRow
                  key={essay.id}
                  essay={essay}
                  read
                  comments={effectiveCommentsMap[essay.id] ?? []}
                  coachReads={readsMap[essay.id] ?? []}
                  onToggled={() => markUnread(essay)}
                />
              ))}
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Spinner className="size-5" />}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label, onReset }: { label: string; onReset?: () => void }) {
  return (
    <div className="space-y-2 py-12 text-center">
      <Inbox className="mx-auto size-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset} className="mt-2 text-xs">
          Zrušit filtry
        </Button>
      )}
    </div>
  );
}

interface ReviewRowProps {
  essay: CoachReviewEssay;
  read: boolean;
  comments: EssayCommentWithAuthor[];
  coachReads: EssayCoachReadWithProfile[];
  onToggled: () => void;
}

export function getEssayCommentThreads(
  comments: EssayCommentWithAuthor[],
  authorProfileId: string,
) {
  const coachComments = comments.filter(
    (c) => c.author?.role === 'coach' || c.author?.role === 'admin',
  );

  if (coachComments.length === 0) {
    return {
      coachComments: [],
      hasCoachComment: false,
      hasAuthorReply: false,
      latestCoachCommentTime: 0,
      threads: [],
    };
  }

  const latestCoachCommentTime = Math.max(
    ...coachComments.map((c) => new Date(c.created_at).getTime()),
  );

  const authorComments = comments.filter((c) => c.author_profile_id === authorProfileId);
  const authorRepliesAfterLatestCoach = authorComments.filter(
    (c) => new Date(c.created_at).getTime() > latestCoachCommentTime,
  );

  const hasAuthorReply = authorRepliesAfterLatestCoach.length > 0;

  const threads = coachComments.map((coachComment) => {
    const directReplies = comments.filter((c) => c.parent_id === coachComment.id);
    const orphanAuthorReplies = comments.filter(
      (c) =>
        c.author_profile_id === authorProfileId &&
        !c.parent_id &&
        new Date(c.created_at).getTime() > new Date(coachComment.created_at).getTime() &&
        !coachComments.some(
          (other) =>
            other.id !== coachComment.id &&
            new Date(other.created_at).getTime() > new Date(coachComment.created_at).getTime() &&
            new Date(c.created_at).getTime() > new Date(other.created_at).getTime(),
        ),
    );

    const allReplies = Array.from(new Set([...directReplies, ...orphanAuthorReplies])).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return {
      coachComment,
      replies: allReplies,
    };
  });

  return {
    coachComments,
    hasCoachComment: true,
    hasAuthorReply,
    latestCoachCommentTime,
    threads,
  };
}

function ReviewRow({
  essay,
  read,
  comments,
  coachReads,
  onToggled,
}: ReviewRowProps) {
  const authorInitial = essay.author?.name?.[0]?.toUpperCase() ?? '?';
  const bookPoints = pointsNumber(essay.book?.book_points);

  const { coachComments, hasCoachComment, latestCoachCommentTime, threads } =
    useMemo(
      () => getEssayCommentThreads(comments, essay.author_profile_id),
      [comments, essay.author_profile_id],
    );

  const hasEditedAfterCoach =
    hasCoachComment &&
    new Date(essay.updated_at).getTime() > latestCoachCommentTime + 60_000;

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-4">
        {/* Main Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href={`/cteni/eseje/${essay.id}`}
            className="group flex flex-1 items-start gap-3.5 min-w-0"
          >
            {/* Book Cover */}
            <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-muted/40">
              {essay.book?.google_books_cover_url ? (
                <StorageImage
                  storageKey={essay.book.google_books_cover_url}
                  alt={essay.book.title_cs}
                  width={40}
                  height={56}
                  className="h-full w-full object-cover"
                />
              ) : essay.book ? (
                <BookOpen className="size-4 text-muted-foreground/30" />
              ) : (
                <Sparkles className="size-4 text-amber-500/40" />
              )}
            </div>

            {/* Essay & Author info */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                {essay.author?.picture ? (
                  <ProfileAvatar picture={essay.author.picture} name={essay.author.name} size={18} />
                ) : (
                  <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {authorInitial}
                  </div>
                )}
                <span className="truncate text-xs font-medium text-foreground">
                  {essay.author?.name}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(essay.created_at).toLocaleDateString('cs-CZ', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              {/* Title */}
              <h3 className="line-clamp-2 text-sm sm:text-base font-bold leading-snug transition-colors group-hover:text-primary">
                {essay.title}
              </h3>

              {/* Book status badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {essay.book ? (
                  <>
                    <span className="truncate font-medium text-foreground/80">
                      {essay.book.title_cs}
                    </span>
                    {bookPoints > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {bookPoints} {bookPoints === 1 ? 'bod' : bookPoints < 5 ? 'body' : 'bodů'}
                      </span>
                    )}
                    <BookStatusBadges book={essay.book} />
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Sparkles className="size-3" />
                    Nad rámec četby
                  </span>
                )}
              </div>
            </div>
          </Link>

          <div className="shrink-0 self-end sm:self-center">
            <CoachReadButton
              essayId={essay.id}
              initialRead={read}
              size="sm"
              onToggled={onToggled}
            />
          </div>
        </div>

        {/* Combined Footer: Coach comments & read status */}
        {(hasCoachComment || (read && coachReads.length > 0)) && (
          <div className="space-y-3 border-t border-border/40 pt-3">
            {/* Header with comments count, edited status & read by */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {hasCoachComment && (
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <MessageCircle className="size-4 text-primary" />
                    Komentáře ({coachComments.length})
                  </span>
                )}
                {hasEditedAfterCoach && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <FilePenLine className="size-3" />
                    Upraveno po komentáři
                  </span>
                )}
              </div>

              {read && coachReads.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <CheckCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Přečteno:</span>
                  {coachReads.map((cr, idx) => (
                    <span key={cr.coach_profile_id} className="font-medium text-foreground">
                      {cr.coach?.name ?? 'Kouč:ka'}
                      {cr.read_at && (
                        <span className="font-normal text-muted-foreground">
                          {' '}({new Date(cr.read_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })})
                        </span>
                      )}
                      {idx < coachReads.length - 1 && <span className="text-muted-foreground/40">,</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comment Threads */}
            {hasCoachComment && (
              <div className="space-y-3">
                {threads.map(({ coachComment, replies }) => (
                  <div key={coachComment.id} className="space-y-2 pl-0.5">
                    {/* Coach quote */}
                    <div className="border-l-2 border-primary/60 pl-3 py-1 space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {coachComment.author?.picture ? (
                          <ProfileAvatar
                            picture={coachComment.author.picture}
                            name={coachComment.author.name}
                            size={18}
                          />
                        ) : (
                          <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {coachComment.author?.name?.[0]?.toUpperCase() ?? 'K'}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-foreground">
                          {coachComment.author?.name}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(coachComment.created_at).toLocaleDateString('cs-CZ', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        „{coachComment.body}“
                      </p>
                    </div>

                    {/* Indented student replies or without reply note */}
                    {replies.length > 0 ? (
                      replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="ml-4 border-l-2 border-emerald-500/50 pl-3 py-1 space-y-1"
                        >
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CornerDownRight className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            {reply.author?.picture ? (
                              <ProfileAvatar
                                picture={reply.author.picture}
                                name={reply.author.name}
                                size={18}
                              />
                            ) : (
                              <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                                {reply.author?.name?.[0]?.toUpperCase() ?? 'T'}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-foreground">
                              {reply.author?.name}
                            </span>
                            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              autor:ka
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(reply.created_at).toLocaleDateString('cs-CZ', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            „{reply.body}“
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="ml-4 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 py-0.5">
                        <Clock className="size-3.5 shrink-0" />
                        <span>Zatím bez odpovědi Téčka</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
