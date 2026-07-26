'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, BookOpen, PenLine, ExternalLink, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfilePicture } from '@/components/profile-picture';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { BookCard } from '@/components/books/book-card';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { cn } from '@/lib/utils';
import { formatPoints, formatPointsWithLabel, pointsNumber } from '@/lib/books/points';
import type { EssayWithDetails } from '@/lib/essays/types';
import type { BookWithProfiles } from '@/lib/books/types';

type EssayWithVoted = EssayWithDetails & { user_has_voted?: boolean };
type BookResult = { id: string; title_cs: string; author: string; google_books_cover_url: string | null };
type CategoryBook = { id: string; title: string; author: string; cover_path: string | null; description: string | null; preview_link: string | null; tags: string[]; book_points: number; essay_count: number };
type TeamMember = { profile_id: string; profile_name: string; profile_picture: string | null; essay_count: number; book_points: number };
type TeamWithMembers = { id: string; name: string; members: TeamMember[] };

interface SearchPageClientProps {
  popularEssays: EssayWithVoted[];
  categoryBestBooks: Record<string, CategoryBook[]>;
  teamsWithMembers: TeamWithMembers[];
}

const CATEGORIES = Object.entries(BOOK_CATEGORY_LABELS);

export function SearchPageClient({ popularEssays, categoryBestBooks, teamsWithMembers }: SearchPageClientProps) {
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
            popularEssays={popularEssays}
            categoryBestBooks={categoryBestBooks}
            teamsWithMembers={teamsWithMembers}
            onSelectCategory={toggleCategory}
          />
        )}
      </div>
    </div>
  );
}

// ─── Discovery ────────────────────────────────────────────────────────────────

function DiscoveryView({
  popularEssays, categoryBestBooks, teamsWithMembers, onSelectCategory,
}: {
  popularEssays: EssayWithVoted[];
  categoryBestBooks: Record<string, CategoryBook[]>;
  teamsWithMembers: TeamWithMembers[];
  onSelectCategory: (key: string) => void;
}) {
  return (
    <div className="space-y-10">
      {popularEssays.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Populární tento týden</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popularEssays.map((essay) => (
              <EssayDiscoveryCard key={essay.id} essay={essay} initialVoted={essay.user_has_voted ?? false} />
            ))}
          </div>
        </section>
      )}

      {teamsWithMembers.length > 0 && (
        <TeamsSection teams={teamsWithMembers} />
      )}

      {Object.keys(categoryBestBooks).length > 0 && (
        <CategoryBestBooksSection
          categoryBestBooks={categoryBestBooks}
          onSelectCategory={onSelectCategory}
        />
      )}
    </div>
  );
}

function EssayDiscoveryCard({ essay, initialVoted }: { essay: EssayWithDetails; initialVoted: boolean }) {
  return (
    <div className="shrink-0 w-52 rounded-xl border bg-card hover:shadow-md transition-shadow group flex flex-col p-3 gap-2.5">
      <Link href={`/eseje/${essay.id}`} className="flex gap-2.5">
        {/* Small portrait cover — at this size low-res thumbnails look fine */}
        <div className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {essay.book?.google_books_cover_url ? (
            <StorageImage
              storageKey={essay.book.google_books_cover_url}
              alt={essay.book?.title_cs ?? ''}
              width={40}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : essay.book ? (
            <BookOpen className="size-4 text-muted-foreground/30" />
          ) : (
            <Sparkles className="size-4 text-amber-500/40" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="size-4 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {essay.author?.picture ? (
                <ProfilePicture src={essay.author.picture} alt={essay.author.name ?? ''} size={16} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-semibold">{essay.author?.name?.[0]}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate">{essay.author?.name}</span>
          </div>
          <p className="font-semibold text-sm leading-snug line-clamp-3 group-hover:text-primary transition-colors">
            {essay.title}
          </p>
          {essay.book ? (
            <p className="text-xs text-muted-foreground truncate">{essay.book.title_cs}</p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Sparkles className="size-3" />
              Nad rámec četby
            </p>
          )}
        </div>
      </Link>
      <div className="border-t pt-2">
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

function TeamsSection({ teams }: { teams: TeamWithMembers[] }) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-base">Týmy</h2>

      {/* Team pills */}
      <div className="flex gap-2 flex-wrap">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => setActiveTeamId((prev) => (prev === team.id ? null : team.id))}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors',
              activeTeamId === team.id
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/50',
            )}
          >
            {/* Avatar stack */}
            <div className="flex -space-x-1.5">
              {team.members.slice(0, 3).map((m) => (
                <div key={m.profile_id} className="size-5 rounded-full overflow-hidden border-2 border-background bg-muted shrink-0 flex items-center justify-center text-[8px] font-semibold">
                  {m.profile_picture
                    ? <ProfilePicture src={m.profile_picture} alt={m.profile_name} size={20} className="w-full h-full object-cover" />
                    : m.profile_name[0]}
                </div>
              ))}
            </div>
            <span>{team.name}</span>
          </button>
        ))}
      </div>

      {/* Expanded member list */}
      {activeTeam && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {activeTeam.members.map((member) => (
              <Link
                key={member.profile_id}
                href={`/komunita/profil/${member.profile_id}`}
                className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="size-8 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center text-xs font-semibold">
                  {member.profile_picture
                    ? <ProfilePicture src={member.profile_picture} alt={member.profile_name} size={32} className="w-full h-full object-cover" />
                    : member.profile_name[0]}
                </div>
                <p className="flex-1 text-sm font-medium group-hover:text-primary transition-colors truncate">
                  {member.profile_name}
                </p>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  {member.essay_count > 0 && (
                    <span className="flex items-center gap-1">
                      <PenLine className="size-3" />
                      {member.essay_count}
                    </span>
                  )}
                  {pointsNumber(member.book_points) > 0 && (
                    <span className="font-medium text-foreground">
                      {formatPoints(member.book_points)} b.
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CategoryBestBooksSection({
  categoryBestBooks, onSelectCategory,
}: {
  categoryBestBooks: Record<string, CategoryBook[]>;
  onSelectCategory: (key: string) => void;
}) {
  const entries = Object.entries(BOOK_CATEGORY_LABELS)
    .filter(([key]) => (categoryBestBooks[key]?.length ?? 0) > 0);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-8">
      {entries.map(([key, label]) => {
        const books = categoryBestBooks[key];
        const totalEssays = books.reduce((s, b) => s + b.essay_count, 0);
        return (
          <section key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">{label}</h2>
              {totalEssays > 0 && (
                <span className="text-xs text-muted-foreground">{totalEssays} esejí</span>
              )}
            </div>

            <div className="divide-y rounded-xl border overflow-hidden bg-card">
              {books.map((book) => (
                <div key={book.id} className="flex gap-3 px-3 py-2.5 group">
                  <Link
                    href={`/knihovna/${book.id}`}
                    className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center mt-0.5"
                  >
                    {book.cover_path ? (
                      <StorageImage storageKey={book.cover_path} alt={book.title} width={40} height={56} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="size-3.5 text-muted-foreground/30" />
                    )}
                  </Link>
                  <div className="flex-1 min-w-0 py-0.5 space-y-1">
                    <Link href={`/knihovna/${book.id}`}>
                      <p className="font-medium text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                    </Link>
                    {book.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{book.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{formatPointsWithLabel(book.book_points)}</span>
                      {book.essay_count > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-muted-foreground">{book.essay_count} esejí</span>
                        </>
                      )}
                      {book.preview_link && (
                        <a
                          href={book.preview_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto flex items-center gap-0.5 text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />Náhled
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => onSelectCategory(key)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Zobrazit vše →
              </button>
            </div>
          </section>
        );
      })}
    </div>
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
                  {book.google_books_cover_url ? (
                    <StorageImage storageKey={book.google_books_cover_url} alt={book.title_cs} width={32} height={44} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="size-3.5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{book.title_cs}</p>
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
                    <ProfilePicture src={essay.author.picture} alt={essay.author.name ?? ''} size={28} className="w-full h-full object-cover" />
                  ) : (
                    (essay.author?.name?.[0] ?? <PenLine className="size-3 text-muted-foreground" />)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{essay.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {essay.author?.name}{essay.book ? ` · ${essay.book.title_cs}` : ''}
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
