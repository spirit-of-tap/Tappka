'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, BookOpen, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { TeamReadingListsHero } from '@/components/books/team-reading-lists-hero';
import { BookCard } from '@/components/books/book-card';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { cn } from '@/lib/utils';
import type { TeamReadingList } from '@/lib/books/team-lists';
import type { EssayWithDetails } from '@/lib/essays/types';
import type { BookWithProfiles } from '@/lib/books/types';

type EssayWithVoted = EssayWithDetails & { user_has_voted?: boolean };
type BookResult = { id: string; title: string; author: string; cover_path: string | null };

interface SearchPageClientProps {
  teamLists: TeamReadingList[];
  popularEssays: EssayWithVoted[];
  topBooks: (BookWithProfiles & { essay_count?: number })[];
  hasTeam: boolean;
}

const CATEGORIES = Object.entries(BOOK_CATEGORY_LABELS);

export function SearchPageClient({ teamLists, popularEssays, topBooks, hasTeam }: SearchPageClientProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ essays: EssayWithVoted[]; books: BookResult[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryBooks, setCategoryBooks] = useState<(BookWithProfiles & { essay_count?: number })[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = encodeURIComponent(query.trim());
        const [eRes, bRes] = await Promise.all([
          fetch(`/api/essays?q=${q}`),
          fetch(`/api/books/search?q=${q}`),
        ]);
        const [{ data: essays }, { data: books }] = await Promise.all([eRes.json(), bRes.json()]);
        setResults({ essays: essays ?? [], books: books ?? [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(() => {
    if (!selectedCategory) { setCategoryBooks([]); return; }
    setCategoryLoading(true);
    fetch(`/api/books?tag=${encodeURIComponent(selectedCategory)}&sort=popular&page_size=40`)
      .then((r) => r.json())
      .then(({ data }) => setCategoryBooks(data ?? []))
      .finally(() => setCategoryLoading(false));
  }, [selectedCategory]);

  const hasQuery = query.trim().length > 0;
  const toggleCategory = (key: string) => setSelectedCategory((prev) => (prev === key ? null : key));

  return (
    <div className="container mx-auto max-w-2xl py-10 space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat eseje, knihy, témata…"
          className="h-12 pl-12 text-base rounded-xl shadow-sm"
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      {/* Category pills */}
      {!hasQuery && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors',
                selectedCategory === key
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="space-y-10">
        {hasQuery ? (
          results ? (
            <SearchResultsView essays={results.essays} books={results.books} />
          ) : (
            <p className="text-center text-muted-foreground text-sm py-12">Hledám…</p>
          )
        ) : selectedCategory ? (
          <CategoryBooksView
            label={BOOK_CATEGORY_LABELS[selectedCategory] ?? selectedCategory}
            books={categoryBooks}
            loading={categoryLoading}
          />
        ) : (
          <DiscoveryView
            teamLists={teamLists}
            popularEssays={popularEssays}
            topBooks={topBooks}
            hasTeam={hasTeam}
          />
        )}
      </div>
    </div>
  );
}

// ─── Discovery ────────────────────────────────────────────────────────────────

function DiscoveryView({
  teamLists, popularEssays, topBooks, hasTeam,
}: {
  teamLists: TeamReadingList[];
  popularEssays: EssayWithVoted[];
  topBooks: (BookWithProfiles & { essay_count?: number })[];
  hasTeam: boolean;
}) {
  return (
    <div className="space-y-10">
      {(teamLists.length > 0 || hasTeam) && (
        <TeamReadingListsHero lists={teamLists} hasTeam={hasTeam} />
      )}

      {popularEssays.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Populární tento týden</h2>
            <Link href="/eseje?sort=week" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Zobrazit vše →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popularEssays.map((essay) => (
              <EssayDiscoveryCard key={essay.id} essay={essay} initialVoted={essay.user_has_voted ?? false} />
            ))}
          </div>
        </section>
      )}

      {topBooks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Aktivní knihy</h2>
            <Link href="/hledat" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Katalog →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topBooks.map((book) => (
              <BookshelfCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Magazine-style essay card: book cover fills the top, essay info below
function EssayDiscoveryCard({ essay, initialVoted }: { essay: EssayWithDetails; initialVoted: boolean }) {
  return (
    <div className="shrink-0 w-52 rounded-xl overflow-hidden border bg-card hover:shadow-md transition-shadow group flex flex-col">
      {/* Visual top: book cover or gradient */}
      <Link href={`/eseje/${essay.id}`} className="block relative h-32 bg-muted overflow-hidden flex-none">
        {essay.book?.cover_path ? (
          <>
            <StorageImage
              storageKey={essay.book.cover_path}
              alt={essay.book.title}
              width={208}
              height={128}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
            <BookOpen className="size-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Author avatar in bottom-left corner */}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <div className="size-5 rounded-full overflow-hidden bg-background/80 shrink-0">
            {essay.author?.picture ? (
              <img src={essay.author.picture} alt={essay.author.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] font-semibold text-foreground">
                {essay.author?.name?.[0]}
              </div>
            )}
          </div>
          <span className="text-[11px] text-white/90 font-medium drop-shadow truncate max-w-[120px]">
            {essay.author?.name}
          </span>
        </div>
      </Link>

      {/* Text body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <Link href={`/eseje/${essay.id}`} className="flex-1">
          <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {essay.title}
          </p>
          {essay.book && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{essay.book.title}</p>
          )}
        </Link>
        <EssayVoteButton
          essayId={essay.id}
          initialVoteCount={essay.vote_count}
          initialVoted={initialVoted}
          size="sm"
        />
      </div>
    </div>
  );
}

// Bookshelf-style book card: prominent cover, minimal text
function BookshelfCard({ book }: { book: BookWithProfiles & { essay_count?: number } }) {
  return (
    <Link href={`/knihovna/${book.id}`} className="shrink-0 w-28 group block">
      <div className="w-full h-40 rounded-lg overflow-hidden bg-muted flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
        {book.cover_path ? (
          <StorageImage
            storageKey={book.cover_path}
            alt={book.title}
            width={112}
            height={160}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <BookOpen className="size-7 text-muted-foreground/30" />
        )}
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {book.title}
        </p>
        {(book.essay_count ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">{book.essay_count} esejí</p>
        )}
      </div>
    </Link>
  );
}

// ─── Category view ─────────────────────────────────────────────────────────────

function CategoryBooksView({
  label, books, loading,
}: {
  label: string;
  books: (BookWithProfiles & { essay_count?: number })[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <BookOpen className="size-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Žádné knihy v kategorii {label}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {books.length} knih v kategorii <span className="font-medium text-foreground">{label}</span>
      </p>
      <div className="space-y-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

// ─── Search results ─────────────────────────────────────────────────────────────

function SearchResultsView({ essays, books }: { essays: EssayWithVoted[]; books: BookResult[] }) {
  if (essays.length === 0 && books.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Search className="size-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Žádné výsledky</p>
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
                href={`/knihovna/${book.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-muted flex items-center justify-center">
                  {book.cover_path ? (
                    <StorageImage storageKey={book.cover_path} alt={book.title} width={32} height={44} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="size-3.5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {essays.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Eseje ({essays.length})
          </h2>
          <div className="divide-y rounded-xl border overflow-hidden bg-card">
            {essays.map((essay) => (
              <Link
                key={essay.id}
                href={`/eseje/${essay.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="shrink-0 size-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold overflow-hidden">
                  {essay.author?.picture ? (
                    <img src={essay.author.picture} alt={essay.author.name} className="w-full h-full object-cover" />
                  ) : (
                    (essay.author?.name?.[0] ?? <PenLine className="size-3 text-muted-foreground" />)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{essay.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {essay.author?.name}{essay.book ? ` · ${essay.book.title}` : ''}
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
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
