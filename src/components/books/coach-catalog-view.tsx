'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  BookOpen,
  Ellipsis,
  ExternalLink,
  FilterX,
  Pencil,
  Radio,
  Rocket,
  RotateCcw,
  Scale,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookRowHeader } from './book-row-header';
import { BookEditDialog } from './book-edit-dialog';
import { DeleteBookDialog } from './delete-book-dialog';
import { PointsDialog } from './points-dialog';
import { HighlightBadge, ListStatusBadge, RocketBadge } from './book-status-badges';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { SourcePointsDialog } from '@/components/content-sources/source-points-dialog';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS, CONTENT_SOURCE_STATUS_LABELS } from '@/lib/content-sources/types';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';
import { cn } from '@/lib/utils';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';
import type { ContentSourceStatus, ContentSourceWithProfiles } from '@/lib/content-sources/types';

export type BookCatalogStatusTab = 'all' | 'shortlist' | 'longlist' | 'rocket' | 'archived';
export type SourceCatalogStatusTab = 'all' | 'approved' | 'archived';

interface CoachCatalogViewProps {
  books: BookWithProfiles[];
  sources: ContentSourceWithProfiles[];
  categories: HighlightCategory[];
  onMoveBook: (book: BookWithProfiles, targetStatus: 'shortlist' | 'longlist') => Promise<boolean>;
  onRestoreBook: (book: BookWithProfiles) => Promise<boolean>;
  onToggleRocketModel: (book: BookWithProfiles) => Promise<boolean>;
  onPointsSaved: (book: BookWithProfiles) => void;
  onBookEdited: (book: BookWithProfiles) => void;
  onBookDeleted: (bookId: string) => void;
  onUpdateSourceStatus: (source: ContentSourceWithProfiles, status: ContentSourceStatus) => Promise<boolean>;
  onUpdateSourcePoints: (source: ContentSourceWithProfiles, points: number | null) => void;
}

const POINT_OPTIONS = ['1', '2', '3'] as const;
/** Rows mounted per progressive-render chunk — keeps tab switches fast. */
const CATALOG_PAGE_SIZE = 50;
const SOURCE_POINT_OPTIONS = ['0.5', '1', '1.5', '2', '2.5', '3'] as const;
const ESSAY_OPTIONS = [
  { value: 'any', label: 'Eseje: všechny' },
  { value: 'has', label: 'Má eseje' },
  { value: 'none', label: 'Bez esejí' },
] as const;

export function CoachCatalogView({
  books,
  sources,
  categories,
  onMoveBook,
  onRestoreBook,
  onToggleRocketModel,
  onPointsSaved,
  onBookEdited,
  onBookDeleted,
  onUpdateSourceStatus,
  onUpdateSourcePoints,
}: CoachCatalogViewProps) {
  const [catalogType, setCatalogType] = usePersistedState<'books' | 'sources'>('tappka:coach-catalog:type', 'books');
  const [bookStatusTab, setBookStatusTab] = usePersistedState<BookCatalogStatusTab>('tappka:coach-catalog:book-status', 'all');
  const [sourceStatusTab, setSourceStatusTab] = usePersistedState<SourceCatalogStatusTab>('tappka:coach-catalog:source-status', 'all');

  // Books filter states
  const [bookQuery, setBookQuery] = useState('');
  const [bookPointFilter, setBookPointFilter] = useState('any');
  const [bookCategoryFilter, setBookCategoryFilter] = useState('any');
  const [bookRocketFilter, setBookRocketFilter] = useState('any');
  const [bookEssayFilter, setBookEssayFilter] = useState('any');

  // Sources filter states
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceKindFilter, setSourceKindFilter] = useState('any');
  const [sourcePointFilter, setSourcePointFilter] = useState('any');

  // Action / dialog states
  const [busyBookId, setBusyBookId] = useState<string | null>(null);
  const [pointsBook, setPointsBook] = useState<BookWithProfiles | null>(null);
  const [editBook, setEditBook] = useState<BookWithProfiles | null>(null);
  const [deleteBook, setDeleteBook] = useState<BookWithProfiles | null>(null);
  const [deleteMode, setDeleteMode] = useState<'delete' | 'duplicate'>('delete');

  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [pointsSource, setPointsSource] = useState<ContentSourceWithProfiles | null>(null);

  // Progressive rendering: mount only the first chunk, auto-append on scroll.
  const [visibleBookCount, setVisibleBookCount] = useState(CATALOG_PAGE_SIZE);
  const [visibleSourceCount, setVisibleSourceCount] = useState(CATALOG_PAGE_SIZE);
  const bookSentinelRef = useRef<HTMLDivElement>(null);
  const sourceSentinelRef = useRef<HTMLDivElement>(null);

  // Reset to the first chunk whenever filters change (list edits clamp via slice).
  useEffect(() => {
    setVisibleBookCount(CATALOG_PAGE_SIZE);
  }, [bookStatusTab, bookQuery, bookPointFilter, bookCategoryFilter, bookRocketFilter, bookEssayFilter]);
  useEffect(() => {
    setVisibleSourceCount(CATALOG_PAGE_SIZE);
  }, [sourceStatusTab, sourceQuery, sourceKindFilter, sourcePointFilter]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    return books.filter((book) => {
      // Status tab filter
      if (bookStatusTab === 'shortlist' && book.list_status !== 'shortlist') return false;
      if (bookStatusTab === 'longlist' && book.list_status !== 'longlist') return false;
      if (bookStatusTab === 'archived' && book.list_status !== 'archived') return false;
      if (bookStatusTab === 'rocket' && !book.is_rocket_model) return false;

      // Text search
      if (q) {
        const haystack = `${book.title_cs} ${book.title_en ?? ''} ${book.author} ${book.isbn_13 ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // Points filter
      if (bookPointFilter !== 'any' && Number(book.book_points) !== Number(bookPointFilter)) return false;

      // Category filter
      if (bookCategoryFilter !== 'any' && book.highlight_category?.id !== bookCategoryFilter) return false;

      // Rocket model filter (only applied if not on rocket tab)
      if (bookStatusTab !== 'rocket') {
        if (bookRocketFilter === 'rocket' && !book.is_rocket_model) return false;
        if (bookRocketFilter === 'non_rocket' && book.is_rocket_model) return false;
      }

      // Essays filter
      if (bookEssayFilter === 'has' && book.essay_count === 0) return false;
      if (bookEssayFilter === 'none' && book.essay_count > 0) return false;

      return true;
    });
  }, [books, bookStatusTab, bookQuery, bookPointFilter, bookCategoryFilter, bookRocketFilter, bookEssayFilter]);

  // Filtered sources
  const filteredSources = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    return sources.filter((source) => {
      if (sourceStatusTab === 'approved' && source.status !== 'approved') return false;
      if (sourceStatusTab === 'archived' && source.status !== 'archived') return false;

      if (q) {
        const haystack = `${source.title} ${source.creator ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (sourceKindFilter !== 'any' && source.kind !== sourceKindFilter) return false;
      if (sourcePointFilter !== 'any' && Number(source.points) !== Number(sourcePointFilter)) return false;

      return true;
    });
  }, [sources, sourceStatusTab, sourceQuery, sourceKindFilter, sourcePointFilter]);

  const hasActiveBookFilters =
    bookQuery.trim() !== '' ||
    bookPointFilter !== 'any' ||
    bookCategoryFilter !== 'any' ||
    bookRocketFilter !== 'any' ||
    bookEssayFilter !== 'any';

  const resetBookFilters = () => {
    setBookQuery('');
    setBookPointFilter('any');
    setBookCategoryFilter('any');
    setBookRocketFilter('any');
    setBookEssayFilter('any');
  };

  const hasActiveSourceFilters =
    sourceQuery.trim() !== '' || sourceKindFilter !== 'any' || sourcePointFilter !== 'any';

  const resetSourceFilters = () => {
    setSourceQuery('');
    setSourceKindFilter('any');
    setSourcePointFilter('any');
  };

  const handleMoveBook = async (book: BookWithProfiles, targetStatus: 'shortlist' | 'longlist') => {
    setBusyBookId(book.id);
    try {
      await onMoveBook(book, targetStatus);
    } finally {
      setBusyBookId(null);
    }
  };

  const handleRestoreBook = async (book: BookWithProfiles) => {
    setBusyBookId(book.id);
    try {
      await onRestoreBook(book);
    } finally {
      setBusyBookId(null);
    }
  };

  const handleToggleRocket = async (book: BookWithProfiles) => {
    setBusyBookId(book.id);
    try {
      await onToggleRocketModel(book);
    } finally {
      setBusyBookId(null);
    }
  };

  const handleToggleSourceStatus = async (source: ContentSourceWithProfiles) => {
    setBusySourceId(source.id);
    const newStatus: ContentSourceStatus = source.status === 'approved' ? 'archived' : 'approved';
    try {
      await onUpdateSourceStatus(source, newStatus);
    } finally {
      setBusySourceId(null);
    }
  };

  const shortlistCount = books.filter((b) => b.list_status === 'shortlist').length;
  const longlistCount = books.filter((b) => b.list_status === 'longlist').length;
  const rocketCount = books.filter((b) => b.is_rocket_model).length;
  const archivedCount = books.filter((b) => b.list_status === 'archived').length;

  const approvedSourcesCount = sources.filter((s) => s.status === 'approved').length;
  const archivedSourcesCount = sources.filter((s) => s.status === 'archived').length;

  const visibleBooks = filteredBooks.slice(0, visibleBookCount);
  const visibleSources = filteredSources.slice(0, visibleSourceCount);

  const growBooks = useCallback(() => {
    setVisibleBookCount((c) => Math.min(c + CATALOG_PAGE_SIZE, filteredBooks.length));
  }, [filteredBooks.length]);
  const growSources = useCallback(() => {
    setVisibleSourceCount((c) => Math.min(c + CATALOG_PAGE_SIZE, filteredSources.length));
  }, [filteredSources.length]);

  useEffect(() => {
    if (catalogType !== 'books' || visibleBookCount >= filteredBooks.length) return;
    const el = bookSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) growBooks();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [catalogType, visibleBookCount, filteredBooks.length, growBooks]);

  useEffect(() => {
    if (catalogType !== 'sources' || visibleSourceCount >= filteredSources.length) return;
    const el = sourceSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) growSources();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [catalogType, visibleSourceCount, filteredSources.length, growSources]);

  return (
    <div className="space-y-4">
      {/* Entity Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center rounded-lg border bg-muted p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setCatalogType('books')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
              catalogType === 'books'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" />
            <span>Knihy</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
              {books.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setCatalogType('sources')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
              catalogType === 'sources'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Radio className="size-3.5" />
            <span>Ostatní zdroje</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
              {sources.length}
            </Badge>
          </button>
        </div>
      </div>

      {/* BOOKS VIEW */}
      {catalogType === 'books' && (
        <div className="space-y-3">
          {/* Status filter segments */}
          <div className="flex flex-wrap items-center gap-1.5 border-b pb-3 text-xs">
            <button
              type="button"
              onClick={() => setBookStatusTab('all')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                bookStatusTab === 'all'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Všechny</span>
              <span className="opacity-70 text-[10px]">({books.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setBookStatusTab('shortlist')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                bookStatusTab === 'shortlist'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Shortlist</span>
              <span className="opacity-70 text-[10px]">({shortlistCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setBookStatusTab('longlist')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                bookStatusTab === 'longlist'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Longlist</span>
              <span className="opacity-70 text-[10px]">({longlistCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setBookStatusTab('rocket')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
                bookStatusTab === 'rocket'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <Rocket className="size-3" />
              <span>Rocket model</span>
              <span className="opacity-80 text-[10px]">({rocketCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setBookStatusTab('archived')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                bookStatusTab === 'archived'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Archiv</span>
              <span className="opacity-70 text-[10px]">({archivedCount})</span>
            </button>
          </div>

          {/* Book Filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="Hledat podle názvu, autora, ISBN…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bookPointFilter} onValueChange={setBookPointFilter}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue placeholder="Body" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Body: všechny</SelectItem>
                  {POINT_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>Body: {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bookCategoryFilter} onValueChange={setBookCategoryFilter}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="Výběr" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Výběr: všechny</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {bookStatusTab !== 'rocket' && (
                <Select value={bookRocketFilter} onValueChange={setBookRocketFilter}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue placeholder="Rocket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Rocket: všechny</SelectItem>
                    <SelectItem value="rocket">Pouze Rocket</SelectItem>
                    <SelectItem value="non_rocket">Mimo Rocket</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={bookEssayFilter} onValueChange={setBookEssayFilter}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue placeholder="Eseje" />
                </SelectTrigger>
                <SelectContent>
                  {ESSAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveBookFilters && (
                <Button size="sm" variant="ghost" onClick={resetBookFilters} className="gap-1">
                  <FilterX className="size-3" />
                  Zrušit
                </Button>
              )}
            </div>
          </div>

          {/* Book Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kniha</TableHead>
                  <TableHead className="hidden md:table-cell">Autor</TableHead>
                  <TableHead className="w-16">Body</TableHead>
                  <TableHead className="w-16 text-right">Eseje</TableHead>
                  <TableHead className="w-28 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                      {books.length === 0
                        ? 'Žádné knihy v katalogu'
                        : 'Žádné knihy neodpovídají zadaným filtrům'}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleBooks.map((book) => {
                    const isBusy = busyBookId === book.id;
                    return (
                      <TableRow key={book.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <BookRowHeader
                              book={book}
                              coverSize="sm"
                              showAuthor={false}
                              titleClassName="max-w-[40vw] block truncate md:max-w-[320px]"
                            >
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {bookStatusTab === 'all' && (
                                  <ListStatusBadge status={book.list_status} />
                                )}
                                {book.is_rocket_model && <RocketBadge />}
                                {book.highlight_category && (
                                  <HighlightBadge category={book.highlight_category} variant="full" />
                                )}
                                {book.list_status === 'archived' && book.list_status_reason && (
                                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                    Důvod: {book.list_status_reason}
                                  </span>
                                )}
                              </div>
                            </BookRowHeader>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="block max-w-[160px] truncate text-sm text-muted-foreground">
                            {book.author}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {formatPoints(book.book_points)} b.
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">{book.essay_count}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Primary move or restore action */}
                            {book.list_status === 'longlist' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => void handleMoveBook(book, 'shortlist')}
                                disabled={isBusy}
                                className="gap-1 h-8 text-xs"
                                title="Posunout do shortlistu"
                              >
                                {isBusy ? <Spinner className="size-3" /> : <ArrowUpRight className="size-3" />}
                                <span className="hidden lg:inline">Do shortlistu</span>
                              </Button>
                            )}
                            {book.list_status === 'shortlist' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleMoveBook(book, 'longlist')}
                                disabled={isBusy}
                                className="gap-1 h-8 text-xs"
                                title="Posunout do longlistu"
                              >
                                {isBusy ? <Spinner className="size-3" /> : <ArrowDownRight className="size-3" />}
                                <span className="hidden lg:inline">Do longlistu</span>
                              </Button>
                            )}
                            {book.list_status === 'archived' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleRestoreBook(book)}
                                disabled={isBusy}
                                className="gap-1 h-8 text-xs"
                                title="Obnovit do longlistu"
                              >
                                {isBusy ? <Spinner className="size-3" /> : <RotateCcw className="size-3" />}
                                <span className="hidden lg:inline">Obnovit</span>
                              </Button>
                            )}

                            {/* Quick Rocket model toggle */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              disabled={isBusy}
                              onClick={() => void handleToggleRocket(book)}
                              title={
                                book.is_rocket_model
                                  ? 'Odebrat z Rocket modelu'
                                  : 'Zařadit do Rocket modelu'
                              }
                            >
                              <Rocket
                                className={cn(
                                  'size-4 transition-colors',
                                  book.is_rocket_model
                                    ? 'text-primary fill-primary'
                                    : 'text-muted-foreground hover:text-foreground',
                                )}
                              />
                            </Button>

                            {/* Dropdown Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-8">
                                  <Ellipsis className="size-4" />
                                  <span className="sr-only">Akce</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setPointsBook(book)} className="gap-2">
                                  <Scale className="size-4" />
                                  Změnit body
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditBook(book)} className="gap-2">
                                  <Pencil className="size-4" />
                                  Upravit knihu
                                </DropdownMenuItem>
                                {book.list_status === 'archived' && (
                                  <DropdownMenuItem onClick={() => void handleRestoreBook(book)} className="gap-2">
                                    <RotateCcw className="size-4" />
                                    Obnovit do longlistu
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeleteMode('duplicate');
                                    setDeleteBook(book);
                                  }}
                                  className="gap-2"
                                >
                                  <ArrowRightLeft className="size-4" />
                                  Označit jako duplikát…
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeleteMode('delete');
                                    setDeleteBook(book);
                                  }}
                                  className="gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                  Smazat
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredBooks.length > CATALOG_PAGE_SIZE && (
            <div ref={bookSentinelRef} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <span>
                Zobrazeno {visibleBooks.length} z {filteredBooks.length}
              </span>
              {visibleBooks.length < filteredBooks.length && <Spinner className="size-4" />}
            </div>
          )}
        </div>
      )}

      {/* SOURCES VIEW */}
      {catalogType === 'sources' && (
        <div className="space-y-3">
          {/* Source status filter segments */}
          <div className="flex flex-wrap items-center gap-1.5 border-b pb-3 text-xs">
            <button
              type="button"
              onClick={() => setSourceStatusTab('all')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                sourceStatusTab === 'all'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Všechny</span>
              <span className="opacity-70 text-[10px]">({sources.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceStatusTab('approved')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                sourceStatusTab === 'approved'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Schválené</span>
              <span className="opacity-70 text-[10px]">({approvedSourcesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceStatusTab('archived')}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                sourceStatusTab === 'archived'
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span>Archivované</span>
              <span className="opacity-70 text-[10px]">({archivedSourcesCount})</span>
            </button>
          </div>

          {/* Sources Filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="Hledat podle názvu zdroje nebo tvůrce…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sourceKindFilter} onValueChange={setSourceKindFilter}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Typ: všechny</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="conference">Konference</SelectItem>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="other">Jiný zdroj</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourcePointFilter} onValueChange={setSourcePointFilter}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue placeholder="Body" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Body: všechny</SelectItem>
                  {SOURCE_POINT_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>Body: {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveSourceFilters && (
                <Button size="sm" variant="ghost" onClick={resetSourceFilters} className="gap-1">
                  <FilterX className="size-3" />
                  Zrušit
                </Button>
              )}
            </div>
          </div>

          {/* Sources Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zdroj</TableHead>
                  <TableHead className="hidden md:table-cell">Typ</TableHead>
                  <TableHead className="w-20">Body</TableHead>
                  <TableHead className="w-24">Stav</TableHead>
                  <TableHead className="w-28 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                      {sources.length === 0
                        ? 'Žádné zdroje v katalogu'
                        : 'Žádné zdroje neodpovídají filtrům'}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleSources.map((source) => {
                    const isBusy = busySourceId === source.id;
                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <ContentSourceIllustration kind={source.kind} className="size-10 shrink-0 rounded-md" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm truncate max-w-[280px]">
                                  {source.title}
                                </span>
                                {source.external_url && (
                                  <a
                                    href={source.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Otevřít odkaz"
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </a>
                                )}
                              </div>
                              {source.creator && (
                                <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                                  {source.creator}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {CONTENT_SOURCE_KIND_LABELS[source.kind]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {formatPoints(source.points)} b.
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={source.status === 'approved' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {CONTENT_SOURCE_STATUS_LABELS[source.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleToggleSourceStatus(source)}
                              disabled={isBusy}
                              className="h-8 text-xs gap-1"
                            >
                              {isBusy ? (
                                <Spinner className="size-3" />
                              ) : source.status === 'approved' ? (
                                'Archivovat'
                              ) : (
                                <>
                                  <RotateCcw className="size-3" />
                                  Obnovit
                                </>
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => setPointsSource(source)}
                              title="Upravit body"
                            >
                              <Scale className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredSources.length > CATALOG_PAGE_SIZE && (
            <div ref={sourceSentinelRef} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <span>
                Zobrazeno {visibleSources.length} z {filteredSources.length}
              </span>
              {visibleSources.length < filteredSources.length && <Spinner className="size-4" />}
            </div>
          )}
        </div>
      )}

      {/* DIALOGS */}
      {pointsBook && (
        <PointsDialog
          book={pointsBook}
          open={!!pointsBook}
          onOpenChange={(open) => {
            if (!open) setPointsBook(null);
          }}
          onSaved={onPointsSaved}
        />
      )}
      {editBook && (
        <BookEditDialog
          book={editBook}
          open={!!editBook}
          onOpenChange={(open) => {
            if (!open) setEditBook(null);
          }}
          onSaved={onBookEdited}
          onDeleted={onBookDeleted}
        />
      )}
      {deleteBook && (
        <DeleteBookDialog
          book={deleteBook}
          open={!!deleteBook}
          onOpenChange={(open) => {
            if (!open) setDeleteBook(null);
          }}
          mode={deleteMode}
          onDeleted={onBookDeleted}
        />
      )}
      {pointsSource && (
        <SourcePointsDialog
          source={pointsSource}
          open={!!pointsSource}
          onOpenChange={(open) => {
            if (!open) setPointsSource(null);
          }}
          onSaved={(updatedSource, newPoints) => {
            onUpdateSourcePoints(updatedSource, newPoints);
          }}
        />
      )}
    </div>
  );
}
