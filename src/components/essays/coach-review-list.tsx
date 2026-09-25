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
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { CoachReadButton } from './coach-read-button';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';

import { formatPoints, pointsLabel } from '@/lib/books/points';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import {
  ALL_TEAMS,
  COACH_REVIEW_DEFAULT_PAGE_SIZE,
  COACH_REVIEW_PARAM,
  COACH_REVIEW_SEARCH_MAX_LENGTH,
  parseCoachReviewParams,
} from '@/lib/essays/coach-review-params';
import type { CoachReviewParams } from '@/lib/essays/coach-review-params';
import { LegacyPointsBadge } from '@/components/essays/legacy-points-badge';
import type {
  CoachReviewEssay,
  CoachReviewPointsFilter,
  CoachReviewReplyFilter,
  CoachReviewRocketFilter,
  CoachReviewTab,
  EssayCoachReadWithProfile,
  EssayCommentWithAuthor,
} from '@/lib/essays/types';

const SEARCH_DEBOUNCE_MS = 300;
const LOAD_MORE_ROOT_MARGIN = '300px';

const STORAGE_KEY = {
  tab: 'tappka:coach-review:tab',
  team: 'tappka:coach-review:team',
  rocket: 'tappka:coach-review:rocket',
  points: 'tappka:coach-review:points',
  reply: 'tappka:coach-review:reply',
} as const;

interface CoachReviewListProps {
  /** Essays of the initially active tab, already filtered server-side. */
  initialEssays?: CoachReviewEssay[];
  initialUnreadCount?: number;
  initialReadCount?: number;
  initialHasMore?: boolean;
  teams?: { id: string; name: string }[];
  defaultTeamId?: string;
  commentsMap?: Record<string, EssayCommentWithAuthor[]>;
  coachReadsMap?: Record<string, EssayCoachReadWithProfile[]>;
  currentCoachId?: string;
  currentCoachName?: string;
  /** Filters the server rendered with (from the URL). */
  initialParams?: CoachReviewParams;
}

interface ReviewFilters {
  tab: CoachReviewTab;
  team: string;
  rocket: CoachReviewRocketFilter;
  points: CoachReviewPointsFilter;
  reply: CoachReviewReplyFilter;
  search: string;
}

function filtersKey(f: ReviewFilters): string {
  return [f.tab, f.team, f.rocket, f.points, f.reply, f.search].join('|');
}

export function CoachReviewList({
  initialEssays = [],
  initialUnreadCount,
  initialReadCount,
  initialHasMore = false,
  teams = [],
  defaultTeamId = ALL_TEAMS,
  commentsMap: initialCommentsMap = {},
  coachReadsMap: initialCoachReadsMap = {},
  currentCoachId,
  currentCoachName = 'Kouč:ka',
  initialParams,
}: CoachReviewListProps) {
  const init = useMemo(
    () => initialParams ?? parseCoachReviewParams(() => undefined, defaultTeamId),
    // Only the first render's params matter; later URL changes come from this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Filters in the URL (shared link, back navigation) win over remembered ones.
  const restoreSaved = { hydrate: !init.hasExplicitFilters };

  const [activeTab, setActiveTab, isTabHydrated] = usePersistedState<CoachReviewTab>(
    STORAGE_KEY.tab,
    init.tab,
    restoreSaved,
  );
  const [teamFilter, setTeamFilter, isTeamHydrated] = usePersistedState<string>(
    STORAGE_KEY.team,
    init.team,
    restoreSaved,
  );
  const [rocketFilter, setRocketFilter, isRocketHydrated] = usePersistedState<CoachReviewRocketFilter>(
    STORAGE_KEY.rocket,
    init.rocket,
    restoreSaved,
  );
  const [pointsFilter, setPointsFilter, isPointsHydrated] = usePersistedState<CoachReviewPointsFilter>(
    STORAGE_KEY.points,
    init.points,
    restoreSaved,
  );
  const [replyFilter, setReplyFilter, isReplyHydrated] = usePersistedState<CoachReviewReplyFilter>(
    STORAGE_KEY.reply,
    init.reply,
    restoreSaved,
  );
  const isHydrated = isTabHydrated && isTeamHydrated && isRocketHydrated && isPointsHydrated && isReplyHydrated;

  // Search is not remembered across visits: a stale query silently hides essays.
  const [searchInput, setSearchInput] = useState(init.search);
  const [search, setSearch] = useState(init.search);
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => setSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const filters: ReviewFilters = useMemo(
    () => ({
      tab: activeTab,
      team: teamFilter,
      rocket: rocketFilter,
      points: pointsFilter,
      reply: replyFilter,
      search,
    }),
    [activeTab, teamFilter, rocketFilter, pointsFilter, replyFilter, search],
  );

  const [essays, setEssays] = useState<CoachReviewEssay[]>(initialEssays);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const [readCount, setReadCount] = useState(initialReadCount ?? 0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [commentsMap, setCommentsMap] =
    useState<Record<string, EssayCommentWithAuthor[]>>(initialCommentsMap);
  const [readsMap, setReadsMap] =
    useState<Record<string, EssayCoachReadWithProfile[]>>(initialCoachReadsMap);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Key of the filters the current `essays` belong to. Responses for any other
  // key (a filter changed mid-request) are dropped instead of being appended.
  const loadedKeyRef = useRef(filtersKey({ ...init }));
  const requestedKeyRef = useRef(loadedKeyRef.current);

  // Keep the URL shareable and in sync with the filters.
  useEffect(() => {
    if (!isHydrated) return;
    const next = new URLSearchParams();
    if (filters.tab !== 'unread') next.set(COACH_REVIEW_PARAM.tab, filters.tab);
    if (filters.team !== defaultTeamId) next.set(COACH_REVIEW_PARAM.team, filters.team);
    if (filters.rocket !== 'all') next.set(COACH_REVIEW_PARAM.rocket, filters.rocket);
    if (filters.points !== 'all') next.set(COACH_REVIEW_PARAM.points, filters.points);
    if (filters.reply !== 'all') next.set(COACH_REVIEW_PARAM.reply, filters.reply);
    if (filters.search) next.set(COACH_REVIEW_PARAM.search, filters.search);
    const qs = next.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (newUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [filters, isHydrated, defaultTeamId]);

  const hasActiveFilters =
    teamFilter !== defaultTeamId ||
    rocketFilter !== 'all' ||
    pointsFilter !== 'all' ||
    replyFilter !== 'all' ||
    search !== '';

  const resetFilters = () => {
    setTeamFilter(defaultTeamId);
    setRocketFilter('all');
    setPointsFilter('all');
    setReplyFilter('all');
    setSearchInput('');
    setSearch('');
  };

  const buildUrl = useCallback((f: ReviewFilters, pageNum: number) => {
    const params = new URLSearchParams({
      [COACH_REVIEW_PARAM.tab]: f.tab,
      [COACH_REVIEW_PARAM.team]: f.team,
      [COACH_REVIEW_PARAM.page]: String(pageNum),
      [COACH_REVIEW_PARAM.pageSize]: String(COACH_REVIEW_DEFAULT_PAGE_SIZE),
    });
    if (f.rocket !== 'all') params.set(COACH_REVIEW_PARAM.rocket, f.rocket);
    if (f.points !== 'all') params.set(COACH_REVIEW_PARAM.points, f.points);
    if (f.reply !== 'all') params.set(COACH_REVIEW_PARAM.reply, f.reply);
    if (f.search) params.set(COACH_REVIEW_PARAM.search, f.search);
    return `/api/essays/coach-review?${params.toString()}`;
  }, []);

  const mergeMaps = (json: {
    commentsMap?: Record<string, EssayCommentWithAuthor[]>;
    coachReadsMap?: Record<string, EssayCoachReadWithProfile[]>;
  }) => {
    if (json.commentsMap) setCommentsMap((prev) => ({ ...prev, ...json.commentsMap }));
    if (json.coachReadsMap) setReadsMap((prev) => ({ ...prev, ...json.coachReadsMap }));
  };

  // Refetch page 1 whenever the filters differ from what is loaded.
  useEffect(() => {
    if (!isHydrated) return;
    const key = filtersKey(filters);
    if (key === requestedKeyRef.current) return;
    requestedKeyRef.current = key;

    async function fetchFiltered() {
      setLoading(true);
      try {
        const res = await fetch(buildUrl(filters, 1));
        if (!res.ok) throw new Error('Fetch failed');
        const json = await res.json();
        if (requestedKeyRef.current !== key) return;
        loadedKeyRef.current = key;
        setEssays(json.data ?? []);
        setUnreadCount(json.unreadCount ?? 0);
        setReadCount(json.readCount ?? 0);
        setHasMore(json.hasMore ?? false);
        setPage(1);
        mergeMaps(json);
      } catch (err) {
        console.error('Failed to fetch filtered essays:', err);
      } finally {
        if (requestedKeyRef.current === key) setLoading(false);
      }
    }

    fetchFiltered();
  }, [filters, isHydrated, buildUrl]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const key = loadedKeyRef.current;
    if (key !== requestedKeyRef.current) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(buildUrl(filters, nextPage));
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      if (loadedKeyRef.current !== key || requestedKeyRef.current !== key) return;
      const newItems = (json.data ?? []) as CoachReviewEssay[];
      setEssays((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        return [...prev, ...newItems.filter((e) => !existingIds.has(e.id))];
      });
      setPage(nextPage);
      setHasMore(newItems.length > 0 && (json.hasMore ?? false));
      mergeMaps(json);
    } catch (err) {
      console.error('Failed to load more essays:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, filters, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: LOAD_MORE_ROOT_MARGIN },
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
    setReadsMap((prev) => ({ ...prev, [essay.id]: [] }));
  };

  const emptyLabel = (tab: CoachReviewTab) => {
    if (search) return `Nic neodpovídá hledání „${search}“`;
    if (hasActiveFilters) {
      return tab === 'unread'
        ? 'Žádné nepřečtené eseje neodpovídají zvoleným filtrům'
        : 'Žádné přečtené eseje neodpovídají zvoleným filtrům';
    }
    return tab === 'unread' ? 'Žádné nové eseje ke kontrole' : 'Zatím tu nejsou žádné přečtené eseje';
  };

  const renderList = (tab: CoachReviewTab) => {
    if (loading && essays.length === 0) {
      return (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      );
    }
    if (essays.length === 0) {
      return (
        <EmptyState label={emptyLabel(tab)} onReset={hasActiveFilters ? resetFilters : undefined} />
      );
    }
    return (
      <div
        aria-busy={loading}
        className={loading ? 'space-y-3 opacity-60 transition-opacity' : 'space-y-3 transition-opacity'}
      >
        {essays.map((essay) => (
          <ReviewRow
            key={essay.id}
            essay={essay}
            read={tab === 'read'}
            comments={commentsMap[essay.id] ?? []}
            coachReads={readsMap[essay.id] ?? []}
            onToggled={() => (tab === 'read' ? markUnread(essay) : markRead(essay))}
          />
        ))}
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && <Spinner className="size-5" />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={COACH_REVIEW_SEARCH_MAX_LENGTH}
            placeholder="Hledat studující, esej, knihu nebo autora…"
            aria-label="Hledat eseje"
            className="pl-9 pr-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
              aria-label="Vymazat hledání"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {teams.length > 0 && (
            <div className="w-[150px] sm:w-[170px]">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger size="sm" className="w-full" aria-label="Tým">
                  <SelectValue placeholder="Tým" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TEAMS}>Všechny týmy</SelectItem>
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
              <SelectTrigger size="sm" className="w-full" aria-label="Rocket model">
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
              <SelectTrigger size="sm" className="w-full" aria-label="Body">
                <SelectValue placeholder="Body" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny body</SelectItem>
                <SelectItem value="1">1 bod</SelectItem>
                <SelectItem value="2">2 body</SelectItem>
                <SelectItem value="3">3 body</SelectItem>
                <SelectItem value="0">Ostatní (0 nebo zlomky)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[170px] sm:w-[195px]">
            <Select
              value={replyFilter}
              onValueChange={(v) => setReplyFilter(v as CoachReviewReplyFilter)}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Komentáře">
                <SelectValue placeholder="Komentáře" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny komentáře</SelectItem>
                <SelectItem value="no-coach-comment">Bez komentáře kouče</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Po komentáři kouče</SelectLabel>
                  <SelectItem value="with-reply">Téčko odpovědělo</SelectItem>
                  <SelectItem value="without-reply">Bez odpovědi Téčka</SelectItem>
                  <SelectItem value="edited-after-comment">Upraveno po komentáři</SelectItem>
                </SelectGroup>
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
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CoachReviewTab)}>
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
          {renderList('unread')}
        </TabsContent>
        <TabsContent value="read" className="mt-4">
          {renderList('read')}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label, onReset }: { label: string; onReset?: () => void }) {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <Inbox className="size-6" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{label}</EmptyTitle>
      </EmptyHeader>
      {onReset && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onReset}>
            Zrušit filtry
          </Button>
        </EmptyContent>
      )}
    </Empty>
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
  const coachComments = comments.filter((c) => c.author?.role === 'coach');

  if (coachComments.length === 0) {
    return {
      coachComments: [],
      hasCoachComment: false,
      hasAuthorReply: false,
      earliestCoachCommentTime: 0,
      latestCoachCommentTime: 0,
      threads: [],
    };
  }

  const coachCommentIds = new Set(coachComments.map((c) => c.id));
  const earliestCoachCommentTime = Math.min(
    ...coachComments.map((c) => new Date(c.created_at).getTime()),
  );
  const latestCoachCommentTime = Math.max(
    ...coachComments.map((c) => new Date(c.created_at).getTime()),
  );

  const authorComments = comments.filter((c) => c.author_profile_id === authorProfileId);
  const hasAuthorReply = authorComments.some(
    (c) =>
      (c.parent_id && coachCommentIds.has(c.parent_id)) ||
      new Date(c.created_at).getTime() > earliestCoachCommentTime,
  );

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
    earliestCoachCommentTime,
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
  const source = getEssaySourceDisplay(essay);

  const { coachComments, hasCoachComment, earliestCoachCommentTime, threads } =
    useMemo(
      () => getEssayCommentThreads(comments, essay.author_profile_id),
      [comments, essay.author_profile_id],
    );

  const hasEditedAfterCoach =
    hasCoachComment &&
    new Date(essay.updated_at).getTime() > earliestCoachCommentTime + 60_000;

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
              ) : essay.content_source ? (
                <ContentSourceIllustration kind={essay.content_source.kind} className="size-full" />
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
                {source.kind !== 'none' ? (
                  <>
                    <span className="truncate font-medium text-foreground/80">
                      {source.title}
                    </span>
                    {source.points > 0 && (
                      source.isFrozen ? (
                        <LegacyPointsBadge
                          points={source.points}
                          label={pointsLabel(source.points)}
                          className="shrink-0"
                        />
                      ) : (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                          {formatPoints(source.points)} {pointsLabel(source.points)}
                        </span>
                      )
                    )}
                    {essay.book && <BookStatusBadges book={essay.book} />}
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
        {(hasCoachComment || coachReads.length > 0) && (
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

              {coachReads.length > 0 && (
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
