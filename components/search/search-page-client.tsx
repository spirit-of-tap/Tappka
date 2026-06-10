'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, BookOpen, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { TeamReadingListsHero } from '@/components/books/team-reading-lists-hero';
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

  // Live search
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

  // Category filter
  useEffect(() => {
    if (!selectedCategory) { setCategoryBooks([]); return; }
    setCategoryLoading(true);
    fetch(`/api/books?tag=${encodeURIComponent(selectedCategory)}&sort=popular&page_size=40`)
      .then((r) => r.json())
      .then(({ data }) => setCategoryBooks(data ?? []))
      .finally(() => setCategoryLoading(false));
  }, [selectedCategory]);

  const hasQuery = query.trim().length > 0;

  const toggleCategory = (key: string) => {
    setSelectedCategory((prev) => (prev === key ? null : key));
  };

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

      {/* Category pills — only when not searching */}
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

      {/* Main content area */}
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

function CategoryBooksView({
  label,
  books,
  loading,
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
      <p className="text-sm text-muted-foreground">{books.length} knih v kategorii <span className="font-medium text-foreground">{label}</span></p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {books.map((book) => (
          <CompactBookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

function DiscoveryView({
  teamLists,
  popularEssays,
  topBooks,
  hasTeam,
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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Populární tento týden</h2>
            <Link href="/eseje?sort=week" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Zobrazit vše →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popularEssays.map((essay) => (
              <CompactEssayCard key={essay.id} essay={essay} initialVoted={essay.user_has_voted ?? false} />
            ))}
          </div>
        </section>
      )}

      {topBooks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Aktivní knihy</h2>
            <Link href="/knihovna" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Katalog →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topBooks.map((book) => (
              <CompactBookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompactEssayCard({ essay, initialVoted }: { essay: EssayWithDetails; initialVoted: boolean }) {
  return (
    <div className="shrink-0 w-52 rounded-xl border bg-card p-3 space-y-2 hover:shadow-sm transition-shadow group">
      {essay.book?.cover_path && (
        <div className="w-full h-24 rounded-md overflow-hidden bg-muted">
          <StorageImage
            storageKey={essay.book.cover_path}
            alt={essay.book.title}
            width={208}
            height={96}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <Link href={`/eseje/${essay.id}`} className="block space-y-0.5">
        <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {essay.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{essay.author?.name}</p>
      </Link>
      <EssayVoteButton
        essayId={essay.id}
        initialVoteCount={essay.vote_count}
        initialVoted={initialVoted}
        size="sm"
      />
    </div>
  );
}

function CompactBookCard({ book }: { book: BookWithProfiles & { essay_count?: number } }) {
  return (
    <div className="group flex flex-col">
      <Link href={`/knihovna/${book.id}`} className="block">
        <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2 flex items-center justify-center">
          {book.cover_path ? (
            <StorageImage
              storageKey={book.cover_path}
              alt={book.title}
              width={160}
              height={240}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <BookOpen className="size-7 text-muted-foreground/30" />
          )}
        </div>
        <p className="text-xs font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {book.title}
        </p>
      </Link>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {(book.essay_count ?? 0) > 0 && (
          <span className="text-xs text-muted-foreground">{book.essay_count} esejí</span>
        )}
        {book.page_count && book.page_count > 0 && (
          <span className="text-xs text-muted-foreground">{book.page_count} str.</span>
        )}
        {book.preview_link && (
          <a
            href={book.preview_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline"
          >
            Náhled
          </a>
        )}
      </div>
    </div>
  );
}

function SearchResultsView({
  essays,
  books,
}: {
  essays: EssayWithVoted[];
  books: BookResult[];
}) {
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
                    <StorageImage
                      storageKey={book.cover_path}
                      alt={book.title}
                      width={32}
                      height={44}
                      className="w-full h-full object-cover"
                    />
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
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {essay.title}
                  </p>
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
