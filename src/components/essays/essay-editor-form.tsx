'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  BookOpen, Check, CloudOff, Search,
  MoreHorizontal, History, Trash2, X,
} from 'lucide-react';

import { BackButton } from './back-button';
import { TiptapEditor } from './tiptap-editor';
import { EssayHistorySheet } from './essay-history-sheet';
import { EssayDeleteButton } from './essay-delete-button';
import { SourceNotFoundCard } from './source-not-found-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { useAutosave, type AutosaveStatus } from '@/lib/essays/use-autosave';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import { countWords, formatReadingTime, formatWordCount } from '@/lib/essays/text-stats';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { cn } from '@/lib/utils';
import type { Book, HighlightCategory } from '@/lib/books/types';
import type { ContentSource } from '@/lib/content-sources/types';
import type { EssayWithDetails } from '@/lib/essays/types';

/** `/api/books/search` returns `BookWithProfiles`-shaped rows; the raw `Book` type is missing the joined highlight_category. */
type BookSearchResult = Book & { highlight_category: HighlightCategory | null };

interface EssayEditorFormProps {
  initialEssay?: EssayWithDetails;
}

/**
 * The only persistence UI in the editor now — there is no manual save or
 * publish button, so this pill (plus the "Ukládá se automaticky" label
 * folded into it) is what tells the author their work isn't lost. A brief
 * green glow marks the moment a save actually lands, so the passive status
 * text has one active beat authors coming from a manual Save button can feel.
 */
function SaveStatus({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  onRetry: () => void;
}) {
  const [justSaved, setJustSaved] = useState(false);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status !== 'saved' || prevStatus === 'saved') return;

    setJustSaved(true);
    const timer = setTimeout(() => setJustSaved(false), 800);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs transition-colors',
        justSaved && 'save-glow border-success/40 bg-success/10',
      )}
    >
      {status === 'error' && (
        <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
          <CloudOff className="size-3.5" />
          Neuloženo
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring rounded underline underline-offset-2 hover:no-underline"
          >
            Zkusit znovu
          </button>
        </span>
      )}

      {status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-pulse" />
          Ukládám…
        </span>
      )}

      {status === 'saved' && lastSavedAt && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Check className="size-3.5 text-success-strong" />
          Uloženo{' '}
          <span className="tabular-nums">
            {lastSavedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      )}

      {/* Nothing saved yet — say up front that the author does not have to. */}
      {status === 'idle' && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Check className="size-3.5 text-muted-foreground/50" />
          Ukládá se samo
        </span>
      )}

      <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">·</span>
      <span className="hidden text-muted-foreground sm:inline">Ukládá se automaticky</span>
    </span>
  );
}

export function EssayEditorForm({ initialEssay }: EssayEditorFormProps) {
  const [title, setTitle] = useState(initialEssay?.title ?? '');
  const [content, setContent] = useState<{ json: object; text: string }>({
    json: initialEssay?.content_json ?? {},
    text: initialEssay?.content_text ?? '',
  });
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(initialEssay?.book as BookSearchResult | null ?? null);
  const [selectedSource, setSelectedSource] = useState<ContentSource | null>(
    (initialEssay?.content_source as ContentSource | null) ?? null,
  );
  const [sourceQuery, setSourceQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [contentSourceResults, setContentSourceResults] = useState<ContentSource[]>([]);
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [isPreselectingBook, setIsPreselectingBook] = useState(false);
  const [isPreselectingSource, setIsPreselectingSource] = useState(false);
  // A keystroke fires a fresh request; only the newest one may write state, or
  // a stale empty response would flash the "not found" card wrongly.
  const sourceSearchRef = useRef(0);
  const [essayId, setEssayId] = useState<string | null>(initialEssay?.id ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The save closure must read the newest values, not the ones captured when
  // the debounce timer was armed.
  const latestRef = useRef({ title, content, bookId: selectedBook?.id ?? null, contentSourceId: selectedSource?.id ?? null, essayId });
  latestRef.current = { title, content, bookId: selectedBook?.id ?? null, contentSourceId: selectedSource?.id ?? null, essayId };

  const creatingRef = useRef(false);

  const persist = useCallback(async () => {
    const { title: t, content: c, bookId, contentSourceId, essayId: id } = latestRef.current;
    const payload = { title: t, content_json: c.json, content_text: c.text, book_id: bookId, content_source_id: contentSourceId };

    if (!id) {
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        const res = await fetch('/api/essays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('create failed');
        const { data } = await res.json();
        setEssayId(data.id);
        latestRef.current.essayId = data.id;
        // Shallow URL swap: router.replace would remount the page and tear
        // down Tiptap mid-sentence. Next's App Router supports the native
        // History API and keeps usePathname in sync.
        window.history.replaceState(null, '', `/cteni/eseje/${data.id}/upravit`);
      } finally {
        creatingRef.current = false;
      }
      return;
    }

    const res = await fetch(`/api/essays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) throw new Error('save failed');
  }, []);

  const hasSomethingToSave = title.trim().length > 0 || content.text.trim().length > 0
    || selectedBook !== null || selectedSource !== null;
  const { status, lastSavedAt, schedule, retry } = useAutosave({
    save: persist,
    enabled: hasSomethingToSave,
  });

  const handleContentChange = useCallback((json: object, text: string) => {
    setContent({ json, text });
    latestRef.current.content = { json, text };
    schedule();
  }, [schedule]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    latestRef.current.title = value;
    schedule();
  }, [schedule]);

  const handleBookChange = useCallback((book: BookSearchResult | null) => {
    setSelectedBook(book);
    latestRef.current.bookId = book?.id ?? null;
    if (book) {
      setSelectedSource(null);
      latestRef.current.contentSourceId = null;
    }
    schedule();
  }, [schedule]);

  const handleSourceChange = useCallback((source: ContentSource | null) => {
    setSelectedSource(source);
    latestRef.current.contentSourceId = source?.id ?? null;
    if (source) {
      setSelectedBook(null);
      latestRef.current.bookId = null;
    }
    schedule();
  }, [schedule]);

  /** One search across both books and content sources, in a single round trip. */
  const searchSources = async (q: string) => {
    if (!q.trim()) {
      setBookResults([]);
      setContentSourceResults([]);
      return;
    }
    const requestId = ++sourceSearchRef.current;
    setIsSearchingSources(true);
    try {
      const res = await fetch(`/api/essays/source-search?q=${encodeURIComponent(q)}`);
      const { data } = await res.json();
      if (requestId === sourceSearchRef.current) {
        setBookResults(data?.books ?? []);
        setContentSourceResults(data?.sources ?? []);
      }
    } finally {
      if (requestId === sourceSearchRef.current) setIsSearchingSources(false);
    }
  };

  // Picking a book/source is itself a savable change even when the author
  // hasn't typed a title or any text yet. `handleBookChange`/`handleSourceChange`
  // call `schedule()` synchronously in the same tick as the state update that
  // flips `hasSomethingToSave`, so that call still reads the *previous*
  // render's (stale) `enabled` value and no-ops. Re-arming here, once the
  // selection has actually committed, picks up the fresh value.
  //
  // This must skip the initial mount: an existing essay already has
  // `selectedBook`/`selectedSource` set from `initialEssay`, so an unguarded
  // effect would call `schedule()` (and a few seconds later PATCH the
  // essay with an unchanged payload) purely from opening the editor.
  //
  // A boolean "have I mounted" ref is not safe here: React 18 StrictMode
  // (on by default in `next dev` under the App Router) double-invokes
  // effects that have no cleanup function, on mount, on the SAME component
  // instance and the SAME ref object. Invocation 1 would flip the boolean
  // to `true` and return; invocation 2 then sees it already `true` and
  // calls `schedule()` anyway — reproducing the exact spurious-autosave bug
  // this guard exists to prevent (only in `next dev`, not production
  // builds, which don't double-invoke). Comparing against the actual
  // previous selection instead is immune to this: both invocations of a
  // mount see identical current-vs-stored values, so both correctly no-op
  // no matter how many times React runs the effect.
  const prevSelectionRef = useRef({
    bookId: selectedBook?.id ?? null,
    sourceId: selectedSource?.id ?? null,
  });
  useEffect(() => {
    const bookId = selectedBook?.id ?? null;
    const sourceId = selectedSource?.id ?? null;
    const changed = prevSelectionRef.current.bookId !== bookId || prevSelectionRef.current.sourceId !== sourceId;
    prevSelectionRef.current = { bookId, sourceId };
    if (changed) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook, selectedSource]);

  const searchParams = useSearchParams();
  const preselectBookId = searchParams.get('book');

  // Returning from /cteni/knihy/nova: attach the book the author just created.
  useEffect(() => {
    if (!preselectBookId || selectedBook) return;

    let cancelled = false;
    setIsPreselectingBook(true);
    void (async () => {
      try {
        const res = await fetch(`/api/books/${preselectBookId}`);
        if (!res.ok) {
          toast.error('Knihu se nepodařilo načíst.');
          return;
        }
        const { data } = await res.json();
        if (!cancelled && data) handleBookChange(data as BookSearchResult);
      } catch {
        if (!cancelled) toast.error('Knihu se nepodařilo načíst.');
      } finally {
        if (!cancelled) setIsPreselectingBook(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectBookId, selectedBook, handleBookChange]);

  const preselectSourceId = searchParams.get('source');

  // Returning from /cteni/eseje/nova?source=... (ContentSourceForm's redirect):
  // attach the content source the author just created.
  useEffect(() => {
    if (!preselectSourceId || selectedSource) return;

    let cancelled = false;
    setIsPreselectingSource(true);
    void (async () => {
      try {
        const res = await fetch(`/api/content-sources/${preselectSourceId}`);
        if (!res.ok) {
          toast.error('Zdroj se nepodařilo načíst.');
          return;
        }
        const { data } = await res.json();
        if (!cancelled && data) {
          handleSourceChange(data as ContentSource);
        }
      } catch {
        if (!cancelled) toast.error('Zdroj se nepodařilo načíst.');
      } finally {
        if (!cancelled) setIsPreselectingSource(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectSourceId, selectedSource, handleSourceChange]);

  const wordCount = countWords(content.text);

  return (
    <div className="space-y-4">
      {/* Top navigation & action bar: Back button alone on the left, save
          status + history + more options grouped on the right. There is no
          publish or manual save button — autosave is the only persistence
          mechanism. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <BackButton />

        <div className="flex items-center gap-1">
          <SaveStatus status={status} lastSavedAt={lastSavedAt} onRetry={() => void retry()} />

          {essayId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Historie verzí"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Další akce">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" />
                    {title.trim() ? 'Smazat esej' : 'Smazat rozepsanou esej'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      {essayId && (
        <>
          <EssayHistorySheet
            essayId={essayId}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />
          <EssayDeleteButton
            essayId={essayId}
            hasTitle={!!title.trim()}
            points={pointsNumber(selectedBook?.book_points)}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}

      {/* Source selector */}
      <section aria-label="Zdroj eseje">
        {selectedBook ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border/40 bg-muted">
                {selectedBook.google_books_cover_url ? (
                  <StorageImage
                    storageKey={selectedBook.google_books_cover_url}
                    alt={selectedBook.title_cs}
                    width={32}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-4 text-muted-foreground/60" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-semibold">{selectedBook.title_cs}</p>
                  <BookStatusBadges book={selectedBook} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{selectedBook.author}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {selectedBook.list_status !== 'archived' && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <span className="font-heading tabular-nums">{formatPoints(selectedBook.book_points)}</span>
                  <span className="ml-1 text-[11px] font-normal text-primary/80">b.</span>
                </span>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleBookChange(null)}
              >
                Změnit
              </Button>
            </div>
          </div>
        ) : selectedSource ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center gap-3">
              <ContentSourceIllustration kind={selectedSource.kind} className="h-11 w-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedSource.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {CONTENT_SOURCE_KIND_LABELS[selectedSource.kind]}
                  {selectedSource.creator ? ` · ${selectedSource.creator}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {selectedSource.status !== 'archived' && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <span className="font-heading tabular-nums">{formatPoints(selectedSource.points)}</span>
                  <span className="ml-1 text-[11px] font-normal text-primary/80">b.</span>
                </span>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleSourceChange(null)}
              >
                Změnit
              </Button>
            </div>
          </div>
        ) : isPreselectingBook || isPreselectingSource ? (
          <div className="flex h-12 items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-3 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            <span>Načítám zdroj…</span>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-2.5 sm:p-3 transition-colors hover:border-primary/30 hover:bg-muted/30">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <BookOpen className="size-3.5 text-primary" />
                <span>Kniha nebo zdroj</span>
                <span className="text-muted-foreground font-normal">(volitelné)</span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Připojením získáš body za četbu
              </span>
            </div>

            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={sourceQuery}
                  aria-label="Hledat knihu nebo jiný zdroj"
                  onChange={(e) => {
                    setSourceQuery(e.target.value);
                    searchSources(e.target.value);
                  }}
                  placeholder="Hledat knihu, podcast, konferenci…"
                  className="h-9.5 bg-background pr-9 pl-9 text-sm shadow-2xs placeholder:text-muted-foreground/70 focus-visible:ring-1"
                />
                {sourceQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceQuery('');
                      setBookResults([]);
                      setContentSourceResults([]);
                    }}
                    className="focus-ring absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Vymazat hledání"
                  >
                    <X className="size-4" />
                  </button>
                ) : isSearchingSources ? (
                  <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                ) : null}
              </div>

              {/* Dropdown search results */}
              {(bookResults.length > 0 || contentSourceResults.length > 0) && (
                <ul className="absolute top-full left-0 right-0 z-20 mt-1.5 max-h-72 divide-y overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
                  {bookResults.map((book) => (
                    <li key={`book-${book.id}`}>
                      <button
                        type="button"
                        className="focus-ring flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          handleBookChange(book);
                          setBookResults([]);
                          setContentSourceResults([]);
                          setSourceQuery('');
                        }}
                      >
                        <div className="flex h-10 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                          {book.google_books_cover_url ? (
                            <StorageImage
                              storageKey={book.google_books_cover_url}
                              alt={book.title_cs}
                              width={28}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BookOpen className="size-4 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{book.title_cs}</p>
                            <BookStatusBadges book={book} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                        </div>
                        {book.list_status !== 'archived' && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {formatPoints(book.book_points)} b.
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                  {contentSourceResults.map((source) => (
                    <li key={`source-${source.id}`}>
                      <button
                        type="button"
                        className="focus-ring flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          handleSourceChange(source);
                          setBookResults([]);
                          setContentSourceResults([]);
                          setSourceQuery('');
                        }}
                      >
                        <ContentSourceIllustration kind={source.kind} className="h-10 w-7 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{source.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{CONTENT_SOURCE_KIND_LABELS[source.kind]}</p>
                        </div>
                        {source.status !== 'archived' && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {formatPoints(source.points)} b.
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sourceQuery.trim() && bookResults.length === 0 && contentSourceResults.length === 0 && !isSearchingSources && (
                <div className="mt-2">
                  <SourceNotFoundCard query={sourceQuery} essayId={essayId ?? undefined} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Title and text: one document, the title set as its heading. */}
      <div className="space-y-3">
        <Label htmlFor="essay-title" className="sr-only">Název eseje</Label>
        <Input
          id="essay-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Název eseje"
          className="h-auto rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-2 font-heading text-2xl leading-tight font-bold shadow-none transition-colors placeholder:text-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-0 md:text-3xl"
        />

        {/* A fixed floor, not a viewport fraction: on a tall window 60vh of
            blank paper reads as a rendering bug rather than an invitation. */}
        <div className="flex min-h-[30rem] flex-col rounded-xl border bg-card shadow-xs">
          <TiptapEditor
            className="flex-1"
            initialContent={initialEssay?.content_json ?? undefined}
            onChange={handleContentChange}
            placeholder="Co tě kniha naučila? Začni psát…"
          />
          <div className="flex items-center gap-2 border-t px-5 py-2 text-xs text-muted-foreground sm:px-8">
            <span className="tabular-nums">{formatWordCount(wordCount)}</span>
            {wordCount > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground/40">·</span>
                <span className="tabular-nums">{formatReadingTime(wordCount)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
