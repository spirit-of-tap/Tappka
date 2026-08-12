'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Save, Send, BookOpen, Check, CloudOff, PenLine, Globe, Search,
  MoreHorizontal, History, Trash2,
} from 'lucide-react';
import { TiptapEditor } from './tiptap-editor';
import { EssayHistorySheet } from './essay-history-sheet';
import { EssayDeleteButton } from './essay-delete-button';
import { useAutosave, type AutosaveStatus } from '@/lib/essays/use-autosave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { BookNotFoundCard } from '@/components/books/book-not-found-card';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import { countWords, formatReadingTime, formatWordCount } from '@/lib/essays/text-stats';
import type { Book, HighlightCategory } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

/** `/api/books/search` returns `BookWithProfiles`-shaped rows; the raw `Book` type is missing the joined highlight_category. */
type BookSearchResult = Book & { highlight_category: HighlightCategory | null };

interface EssayEditorFormProps {
  initialEssay?: EssayWithDetails;
}

/**
 * Reads as plain text right next to the Koncept badge, not as a pill at the
 * other end of the row: "what this essay is" and "whether it is safe" are one
 * thought, and nobody should have to connect two corners of the page to get it.
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
  if (status === 'error') {
    return (
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
    );
  }

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-pulse" />
        Ukládám…
      </span>
    );
  }

  if (status === 'saved' && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Check className="size-3.5 text-success-strong" />
        Uloženo{' '}
        <span className="tabular-nums">
          {lastSavedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </span>
    );
  }

  // Nothing saved yet — say up front that the author does not have to.
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Check className="size-3.5 text-muted-foreground/50" />
      Ukládá se samo
    </span>
  );
}

export function EssayEditorForm({ initialEssay }: EssayEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialEssay?.title ?? '');
  const [content, setContent] = useState<{ json: object; text: string }>({
    json: initialEssay?.content_json ?? {},
    text: initialEssay?.content_text ?? '',
  });
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(initialEssay?.book as BookSearchResult | null ?? null);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [isPreselectingBook, setIsPreselectingBook] = useState(false);
  // A keystroke fires a fresh request; only the newest one may write state, or
  // a stale empty response would flash the "Nemůžeš najít knihu?" card wrongly.
  const bookSearchRef = useRef(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [essayId, setEssayId] = useState<string | null>(initialEssay?.id ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isDraft = initialEssay?.published_at == null;

  // The save closure must read the newest values, not the ones captured when
  // the debounce timer was armed.
  const latestRef = useRef({ title, content, bookId: selectedBook?.id ?? null, essayId });
  latestRef.current = { title, content, bookId: selectedBook?.id ?? null, essayId };

  const creatingRef = useRef(false);

  const persist = useCallback(async () => {
    const { title: t, content: c, bookId, essayId: id } = latestRef.current;
    const payload = { title: t, content_json: c.json, content_text: c.text, book_id: bookId };

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

  const hasSomethingToSave = title.trim().length > 0 || content.text.trim().length > 0;
  const { status, lastSavedAt, statusRef, schedule, flush, retry } = useAutosave({
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
    schedule();
  }, [schedule]);

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

  const handlePrimaryAction = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      await flush();
      // Autosave exhausted its retries — publishing would ship stale content.
      if (statusRef.current === 'error') {
        toast.error('Automatické ukládání selhalo. Zkus uložit znovu a pak publikuj.');
        return;
      }
      const id = latestRef.current.essayId;
      if (!id) {
        toast.error('Esej se zatím nepodařilo uložit.');
        return;
      }

      if (!isDraft) {
        toast.success('Změny uloženy.');
        router.push(`/cteni/eseje/${id}`);
        return;
      }

      const res = await fetch(`/api/essays/${id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se zveřejnit esej.');
        return;
      }
      toast.success('Esej publikována.');
      router.push(`/cteni/eseje/${id}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const searchBooks = async (q: string) => {
    if (!q.trim()) { setBookResults([]); return; }
    const requestId = ++bookSearchRef.current;
    setIsSearchingBooks(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const { data } = await res.json();
      if (requestId === bookSearchRef.current) setBookResults(data ?? []);
    } finally {
      if (requestId === bookSearchRef.current) setIsSearchingBooks(false);
    }
  };

  const wordCount = countWords(content.text);
  const needsTitle = isDraft && !title.trim();


  return (
    <div className="space-y-5">
      {/* Status strip: what this essay is, whether it is safe, what you can do
          with it. The badge and the save state sit together on purpose. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {isDraft ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 font-medium text-primary">
              <PenLine className="size-3" />
              Koncept
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground">
              <Globe className="size-3" />
              Zveřejněná
            </span>
          )}
          <SaveStatus status={status} lastSavedAt={lastSavedAt} onRetry={() => void retry()} />
          {/* Only the koncept case earns a sentence — that a draft is private is
              worth teaching, whereas "saving publishes it" is self-evident. Kept
              off small screens, where the badge alone carries it. */}
          {isDraft && (
            <>
              <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">·</span>
              <span className="hidden text-muted-foreground sm:inline">
                Uvidíš ji jenom ty, dokud ji nezveřejníš.
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => void handlePrimaryAction()}
              disabled={isPublishing || needsTitle}
              size="sm"
            >
              {isPublishing ? (
                <Spinner className="mr-2 size-4" />
              ) : isDraft ? (
                <Send className="mr-2 size-4" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {isDraft ? 'Zveřejnit' : 'Uložit změny'}
            </Button>

            {/* History and delete live behind one control: three buttons across
                the top crowded the strip, and only one of them is the action an
                author came here to take. Nothing to show before the essay
                exists as a row. */}
            {essayId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Další akce">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                    <History className="size-4" />
                    Historie verzí
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" />
                    {isDraft ? 'Smazat koncept' : 'Smazat esej'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {/* The publish button is disabled without a title; say why rather
              than leaving the author to guess at a dead control. */}
          {needsTitle && (
            <p className="text-xs text-muted-foreground">Esej potřebuje název, aby šla zveřejnit.</p>
          )}
        </div>
      </div>

      {essayId && (
        <>
          <EssayHistorySheet
            essayId={essayId}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />
          <EssayDeleteButton
            essayId={essayId}
            isDraft={isDraft}
            points={pointsNumber(selectedBook?.book_points)}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}

      {/* The book comes first: it is the choice that decides whether the essay
          earns BookPoints, and it is the one thing an author can get wrong. */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Kniha, o které píšeš
        </h2>

        {selectedBook ? (
          <div className="space-y-2 rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-[68px] w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border/40 bg-muted">
                {selectedBook.google_books_cover_url ? (
                  <StorageImage
                    storageKey={selectedBook.google_books_cover_url}
                    alt={selectedBook.title_cs}
                    width={48}
                    height={68}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-5 text-muted-foreground/60" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-heading font-semibold">{selectedBook.title_cs}</p>
                  <BookStatusBadges book={selectedBook} />
                </div>
                <p className="truncate text-sm text-muted-foreground">{selectedBook.author}</p>
              </div>

              {selectedBook.list_status !== 'archived' && (
                <p className="shrink-0 text-right leading-none">
                  <span className="font-heading text-2xl font-bold tabular-nums text-primary">
                    {formatPoints(selectedBook.book_points)}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">b.</span>
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => handleBookChange(null)}
              >
                Změnit
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Nemůžeš najít tu správnou knihu?{' '}
              <Link
                href={`/cteni/knihy/nova?from=esej${essayId ? `&essayId=${essayId}` : ''}`}
                className="focus-ring rounded underline underline-offset-2 hover:text-foreground"
              >
                Přidat novou do BOBa
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/40 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                <BookOpen className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  {isPreselectingBook ? (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Spinner className="size-3.5" />
                      Načítám knihu…
                    </p>
                  ) : (
                    <p className="font-medium">Vyber knihu, ke které esej patří</p>
                  )}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={bookQuery}
                    aria-label="Hledat knihu"
                    onChange={(e) => { setBookQuery(e.target.value); searchBooks(e.target.value); }}
                    placeholder="Hledat knihu podle názvu nebo autora…"
                    className="h-10 bg-background pr-9 pl-9"
                  />
                  {isSearchingBooks && (
                    <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>

                {/* Capped so a broad query does not shove the title and the
                    writing surface off the screen. */}
                {bookResults.length > 0 && (
                  <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border bg-background">
                    {bookResults.map((book) => (
                      <li key={book.id}>
                        <button
                          type="button"
                          className="focus-ring flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
                          onClick={() => { handleBookChange(book); setBookResults([]); setBookQuery(''); }}
                        >
                          <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                            {book.google_books_cover_url ? (
                              <StorageImage
                                storageKey={book.google_books_cover_url}
                                alt={book.title_cs}
                                width={32}
                                height={44}
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
                  </ul>
                )}

                <p className="text-xs text-muted-foreground">
                  Píšeš o něčem mimo seznam? Nech pole prázdné — esej se počítá jako četba nad
                  rámec.
                </p>

                {/* Only a search that came up empty deserves the invitation to
                    add the book — it is the moment the author is stuck, not a
                    standing banner. */}
                {bookQuery.trim() && bookResults.length === 0 && !isSearchingBooks && (
                  <BookNotFoundCard query={bookQuery} from="esej" essayId={essayId ?? undefined} />
                )}
              </div>
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
