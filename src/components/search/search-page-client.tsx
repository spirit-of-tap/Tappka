'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  BookOpen,
  PenLine,
  Sparkles,
  Rocket,
  Medal,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Crown,
  Briefcase,
  Megaphone,
  Boxes,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BookCard } from '@/components/books/book-card';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { BookNotFoundCard } from '@/components/books/book-not-found-card';
import { type BookEssayItem } from '@/components/books/feed-book-card';
import { ContentSourceCard } from '@/components/content-sources/content-source-card';
import { DiscoveryMixedFeed } from './discovery-mixed-feed';
import type { AuthorGamificationStats } from '@/components/essays/social-essay-feed-card';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { cn } from '@/lib/utils';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { EssayWithDetails } from '@/lib/essays/types';
import type { BookListStatus, BookWithProfiles, HighlightCategory } from '@/lib/books/types';
import type { HighlightedGroup } from '@/lib/books/highlight-groups';
import type { ContentSource } from '@/lib/content-sources/types';

type EssayWithVoted = EssayWithDetails & { user_has_voted?: boolean };
type BookResult = {
  id: string;
  title_cs: string;
  author: string;
  google_books_cover_url: string | null;
  in_library: boolean;
  list_status: BookListStatus;
  is_rocket_model: boolean;
  highlight_category: HighlightCategory | null;
};
type CategoryBook = { id: string; title: string; author: string; cover_path: string | null; description: string | null; preview_link: string | null; tags: string[]; book_points: number; essay_count: number; list_status: BookListStatus; is_rocket_model: boolean; highlight_category: HighlightCategory | null };

interface SearchPageClientProps {
  books?: BookWithProfiles[];
  libraryBookIds?: string[];
  essaysByBookId?: Record<string, BookEssayItem[]>;
  popularEssays: EssayWithVoted[];
  recentEssays?: EssayWithVoted[];
  teamEssays?: EssayWithVoted[];
  teamNamesById?: Record<string, string>;
  authorStatsById?: Record<string, AuthorGamificationStats>;
  userTeamName?: string | null;
  userTeamId?: string | null;
  categoryBestBooks: Record<string, CategoryBook[]>;
  rocketModelBooks: BookWithProfiles[];
  highlightedByCategory: HighlightedGroup[];
  contentSources?: ContentSource[];
}

const CATEGORIES = Object.entries(BOOK_CATEGORY_LABELS);
const FINE_POINTER_QUERY = '(pointer: fine)';

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string }> = {
  'Finance & ekonomika': { icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  'Inovace & kreativita': { icon: Lightbulb, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  'Komunikace & prodej': { icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  Leadership: { icon: Crown, color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  Management: { icon: Briefcase, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  Marketing: { icon: Megaphone, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
  Multidisciplinární: { icon: Boxes, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10' },
  'Osobní rozvoj': { icon: Sparkles, color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10' },
};

export function SearchPageClient({
  books = [],
  libraryBookIds = [],
  essaysByBookId = {},
  popularEssays,
  recentEssays = [],
  teamEssays = [],
  teamNamesById = {},
  authorStatsById = {},
  userTeamName = null,
  userTeamId = null,
  categoryBestBooks,
  rocketModelBooks,
  highlightedByCategory,
  contentSources = [],
}: SearchPageClientProps) {
  const [query, setQuery] = usePersistedState('tappka:search:query', '', { storage: 'sessionStorage' });
  const [results, setResults] = useState<{ essays: EssayWithVoted[]; books: BookResult[]; sources: ContentSource[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = usePersistedState<string | null>('tappka:search:category', null, { storage: 'sessionStorage' });
  const [categoryBooks, setCategoryBooks] = useState<(BookWithProfiles & { essay_count?: number })[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [libraryFilterEnabled, setLibraryFilterEnabled] = usePersistedState('tappka:search:library-filter', false, { storage: 'sessionStorage' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchIdRef = useRef(0);
  const categoryIdRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia(FINE_POINTER_QUERY).matches) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      searchIdRef.current += 1;
      setResults(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const requestId = ++searchIdRef.current;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = encodeURIComponent(query.trim());
        const [eRes, bRes, sRes] = await Promise.all([
          fetch(`/api/essays?q=${q}`),
          fetch(`/api/books/search?q=${q}`),
          fetch(`/api/content-sources?q=${q}`),
        ]);
        const [{ data: essays }, { data: books }, { data: sources }] = await Promise.all([eRes.json(), bRes.json(), sRes.json()]);
        if (requestId === searchIdRef.current) {
          setResults({ essays: essays ?? [], books: books ?? [], sources: sources ?? [] });
        }
      } finally {
        if (requestId === searchIdRef.current) setLoading(false);
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(() => {
    if (!selectedCategory) { setCategoryBooks([]); return; }
    const requestId = ++categoryIdRef.current;
    setCategoryLoading(true);
    const params = new URLSearchParams({
      tag: selectedCategory,
      sort: 'popular',
      page_size: '40',
    });
    if (libraryFilterEnabled) params.set('library_only', 'true');
    fetch(`/api/books?${params}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (requestId === categoryIdRef.current) setCategoryBooks(data ?? []);
      })
      .finally(() => {
        if (requestId === categoryIdRef.current) setCategoryLoading(false);
      });
  }, [selectedCategory, libraryFilterEnabled]);

  const hasQuery = query.trim().length > 0;

  return (
    <PageShell size="narrow">
      <h1 className="sr-only">Objevovat</h1>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat eseje, knihy, témata…"
          className="h-12 pl-12 text-base rounded-xl shadow-sm"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      {/* Content */}
      <div className="space-y-10">
        {hasQuery ? (
          results ? (
            <SearchResultsView essays={results.essays} books={results.books} sources={results.sources} query={query} />
          ) : (
            <p className="text-center text-muted-foreground text-sm py-12">Hledám…</p>
          )
        ) : selectedCategory ? (
          <CategoryBooksView
            label={BOOK_CATEGORY_LABELS[selectedCategory] ?? selectedCategory}
            books={categoryBooks}
            loading={categoryLoading}
            libraryFilterEnabled={libraryFilterEnabled}
            onToggleLibraryFilter={setLibraryFilterEnabled}
            onBack={() => setSelectedCategory(null)}
          />
        ) : (
          <DiscoveryView
            books={books}
            libraryBookIds={libraryBookIds}
            essaysByBookId={essaysByBookId}
            popularEssays={popularEssays}
            recentEssays={recentEssays}
            teamEssays={teamEssays}
            teamNamesById={teamNamesById}
            authorStatsById={authorStatsById}
            userTeamName={userTeamName}
            userTeamId={userTeamId}
            categoryBestBooks={categoryBestBooks}
            rocketModelBooks={rocketModelBooks}
            highlightedByCategory={highlightedByCategory}
            contentSources={contentSources}
            onSelectCategory={setSelectedCategory}
          />
        )}
      </div>
    </PageShell>
  );
}

// ─── Discovery ────────────────────────────────────────────────────────────────

function DiscoveryView({
  books,
  libraryBookIds,
  essaysByBookId,
  popularEssays,
  recentEssays,
  teamEssays,
  teamNamesById,
  authorStatsById,
  userTeamName,
  userTeamId,
  categoryBestBooks,
  rocketModelBooks,
  highlightedByCategory,
  contentSources,
  onSelectCategory,
}: {
  books: BookWithProfiles[];
  libraryBookIds: string[];
  essaysByBookId: Record<string, BookEssayItem[]>;
  popularEssays: EssayWithVoted[];
  recentEssays: EssayWithVoted[];
  teamEssays: EssayWithVoted[];
  teamNamesById: Record<string, string>;
  authorStatsById: Record<string, AuthorGamificationStats>;
  userTeamName: string | null;
  userTeamId: string | null;
  categoryBestBooks: Record<string, CategoryBook[]>;
  rocketModelBooks: BookWithProfiles[];
  highlightedByCategory: HighlightedGroup[];
  contentSources: ContentSource[];
  onSelectCategory: (key: string) => void;
}) {
  return (
    <div className="space-y-8">
      {/* 1. Curated Selections: TOP BOB & Rocket Model */}
      {(highlightedByCategory.length > 0 || rocketModelBooks.length > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {highlightedByCategory.length > 0 && <TopPicksCard groups={highlightedByCategory} />}
          {rocketModelBooks.length > 0 && <RocketModelCard books={rocketModelBooks} />}
        </div>
      )}

      {/* 2. Book Categories Grid (2 columns on mobile) */}
      <CategoryGridSection
        categoryBestBooks={categoryBestBooks}
        onSelectCategory={onSelectCategory}
      />

      {/* 2b. Other content sources: podcasts, conferences, programs */}
      {contentSources.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Ostatní zdroje</h2>
            <Link href="/cteni/zdroje" className="text-sm font-medium text-primary hover:underline">
              Zobrazit vše
            </Link>
          </div>
          <div className="space-y-2">
            {contentSources.slice(0, 5).map((source) => (
              <ContentSourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Mixed Stream: Books with Interleaved Community Essays */}
      <DiscoveryMixedFeed
        books={books}
        libraryBookIds={libraryBookIds}
        essaysByBookId={essaysByBookId}
        recentEssays={recentEssays}
        popularEssays={popularEssays}
        teamEssays={teamEssays}
        teamNamesById={teamNamesById}
        authorStatsById={authorStatsById}
        userTeamName={userTeamName}
        userTeamId={userTeamId}
      />
    </div>
  );
}

function TopPicksCard({ groups }: { groups: HighlightedGroup[] }) {
  const totalBooks = groups.reduce((sum, g) => sum + g.books.length, 0);

  return (
    <Link
      href="/cteni/knihy/top-bob"
      className="group flex items-center gap-2 sm:gap-3 rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-500/10 via-card to-card p-2.5 sm:p-3 transition-all hover:border-amber-400 hover:shadow-sm dark:border-amber-900/50 dark:from-amber-950/30 cursor-pointer"
    >
      <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
        <Medal className="size-3.5 sm:size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">TOP BOB</h3>
          <span className="text-[11px] text-muted-foreground shrink-0">· {totalBooks}</span>
        </div>
        <p className="hidden sm:block truncate text-xs text-muted-foreground">
          Doporučená četba
        </p>
      </div>
      <ArrowRight className="hidden sm:block size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function RocketModelCard({ books }: { books: BookWithProfiles[] }) {
  return (
    <Link
      href="/cteni/knihy/rocket-model"
      className="group flex items-center gap-2 sm:gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-2.5 sm:p-3 transition-all hover:border-primary/50 hover:shadow-sm dark:border-primary/30 dark:from-primary/15 cursor-pointer"
    >
      <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Rocket className="size-3.5 sm:size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">Rocket Model</h3>
          <span className="text-[11px] text-muted-foreground shrink-0">· {books.length}</span>
        </div>
        <p className="hidden sm:block truncate text-xs text-muted-foreground">
          Klíčové knihy
        </p>
      </div>
      <ArrowRight className="hidden sm:block size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function CategoryGridSection({
  categoryBestBooks,
  onSelectCategory,
}: {
  categoryBestBooks: Record<string, CategoryBook[]>;
  onSelectCategory: (key: string) => void;
}) {
  return (
    <section className="space-y-3 pt-2">
      <h2 className="text-sm sm:text-base font-semibold text-foreground">Knihy podle kategorií</h2>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {CATEGORIES.map(([key, label]) => {
          const meta = CATEGORY_META[key] ?? { icon: BookOpen, color: 'text-primary bg-primary/10' };
          const Icon = meta.icon;
          const books = categoryBestBooks[key] ?? [];
          const totalEssays = books.reduce((s, b) => s + b.essay_count, 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectCategory(key)}
              className="group flex items-center gap-2.5 sm:gap-3 rounded-xl border bg-card p-2.5 sm:p-3 text-left transition-all hover:border-primary/40 hover:shadow-xs focus-ring cursor-pointer"
            >
              <span className={cn('flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                <Icon className="size-4 sm:size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {label}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {totalEssays > 0 ? `${totalEssays} esejí` : 'Procházet'}
                </p>
              </div>
              <ChevronRight className="size-3.5 sm:size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Category view ─────────────────────────────────────────────────────────────

function CategoryBooksView({
  label,
  books,
  loading,
  libraryFilterEnabled,
  onToggleLibraryFilter,
  onBack,
}: {
  label: string;
  books: (BookWithProfiles & { essay_count?: number })[];
  loading: boolean;
  libraryFilterEnabled: boolean;
  onToggleLibraryFilter: (enabled: boolean) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            Zpět na přehled
          </button>
          <h2 className="text-xl font-bold text-foreground">{label}</h2>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={libraryFilterEnabled}
            onChange={(e) => onToggleLibraryFilter(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          Pouze knihy v TAP Knihovně
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <BookOpen className="size-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Žádné knihy v kategorii {label}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search results ─────────────────────────────────────────────────────────────

function SearchResultsView({
  essays,
  books,
  sources,
  query,
}: {
  essays: EssayWithVoted[];
  books: BookResult[];
  sources: ContentSource[];
  query: string;
}) {
  if (essays.length === 0 && books.length === 0 && sources.length === 0) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 py-12 text-center">
          <Search className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Žádné výsledky</p>
        </div>
        <BookNotFoundCard query={query} from="hledat" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {books.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Knihy ({books.length})
          </h2>
          <div className="divide-y rounded-xl border overflow-hidden bg-card">
            {books.map((book) => (
              <Link
                key={book.id}
                href={`/cteni/knihy/${book.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-muted flex items-center justify-center">
                  {book.google_books_cover_url ? (
                    <StorageImage storageKey={book.google_books_cover_url} alt={book.title_cs} width={32} height={44} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="size-3.5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{book.title_cs}</p>
                    <BookStatusBadges book={book} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                </div>
                {book.in_library && (
                  <Badge variant="default" className="text-[11px] px-2.5 py-1">
                    V TAPu
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ostatní zdroje ({sources.length})
          </h2>
          <div className="space-y-2">
            {sources.map((source) => (
              <ContentSourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      )}

      <BookNotFoundCard query={query} from="hledat" />

      {essays.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Eseje ({essays.length})
          </h2>
          <div className="divide-y rounded-xl border overflow-hidden bg-card">
            {essays.map((essay) => {
              const sourceTitle = getEssaySourceDisplay(essay).title;
              return (
              <Link
                key={essay.id}
                href={`/cteni/eseje/${essay.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="shrink-0 size-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold overflow-hidden">
                  {essay.author?.picture ? (
                    <ProfileAvatar picture={essay.author.picture} name={essay.author.name} size={28} className="w-full h-full" />
                  ) : (
                    (essay.author?.name?.[0] ?? <PenLine className="size-3 text-muted-foreground" />)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{essay.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {essay.author?.name}{sourceTitle ? ` · ${sourceTitle}` : ''}
                  </p>
                </div>
                <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {essay.vote_count}
                </span>
              </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
