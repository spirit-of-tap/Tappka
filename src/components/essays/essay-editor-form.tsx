'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Send, BookOpen, X } from 'lucide-react';
import { TiptapEditor } from './tiptap-editor';
import { EssayHistorySheet } from './essay-history-sheet';
import { useAutosave } from '@/lib/essays/use-autosave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { formatPoints } from '@/lib/books/points';
import type { Book, HighlightCategory } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

/** `/api/books/search` returns `BookWithProfiles`-shaped rows; the raw `Book` type is missing the joined highlight_category. */
type BookSearchResult = Book & { highlight_category: HighlightCategory | null };

interface EssayEditorFormProps {
  initialEssay?: EssayWithDetails;
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [essayId, setEssayId] = useState<string | null>(initialEssay?.id ?? null);
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
  const { status, lastSavedAt, schedule, flush, retry } = useAutosave({
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

  const handlePrimaryAction = async () => {
    setIsPublishing(true);
    try {
      await flush();
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
    const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
    const { data } = await res.json();
    setBookResults(data ?? []);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="essay-title">Název eseje</Label>
        <Input
          id="essay-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Název eseje..."
          className="text-lg font-medium"
        />
        <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
          {status === 'saving' && <span>Ukládám…</span>}
          {status === 'saved' && lastSavedAt && (
            <span>Uloženo {lastSavedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          {status === 'error' && (
            <>
              <span className="text-destructive">Neuloženo</span>
              <button
                type="button"
                onClick={() => void retry()}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Zkusit znovu
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kniha (volitelné)</Label>
        {selectedBook ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
              {selectedBook.google_books_cover_url ? (
                <StorageImage
                  storageKey={selectedBook.google_books_cover_url}
                  alt={selectedBook.title_cs}
                  width={36}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <BookOpen className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs text-muted-foreground">Zdroj</p>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{selectedBook.title_cs}</p>
                <BookStatusBadges book={selectedBook} />
              </div>
              <p className="truncate text-xs text-muted-foreground">{selectedBook.author}</p>
            </div>
            {selectedBook.list_status !== 'archived' && (
              <Badge variant="secondary" className="shrink-0">{formatPoints(selectedBook.book_points)} b.</Badge>
            )}
            <button
              type="button"
              onClick={() => handleBookChange(null)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Odebrat knihu"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={bookQuery}
              onChange={(e) => { setBookQuery(e.target.value); searchBooks(e.target.value); }}
              placeholder="Hledat knihu..."
            />
            {bookResults.length > 0 && (
              <div className="border rounded-md divide-y">
                {bookResults.map((book) => (
                  <button
                    key={book.id}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => { handleBookChange(book); setBookResults([]); setBookQuery(''); }}
                  >
                    <div className="flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {book.google_books_cover_url ? (
                        <StorageImage
                          storageKey={book.google_books_cover_url}
                          alt={book.title_cs}
                          width={32}
                          height={48}
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
                      <Badge variant="secondary" className="shrink-0 text-xs">{formatPoints(book.book_points)} b.</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Text eseje</Label>
        <div className="border rounded-md overflow-hidden min-h-[400px]">
          <TiptapEditor
            initialContent={initialEssay?.content_json ?? undefined}
            onChange={handleContentChange}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handlePrimaryAction()}
          disabled={isPublishing || (isDraft && !title.trim())}
          size="lg"
        >
          {isPublishing ? <Spinner className="size-4 mr-2" /> : isDraft ? <Send className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
          {isDraft ? 'Zveřejnit' : 'Uložit změny'}
        </Button>
        {essayId && <EssayHistorySheet essayId={essayId} />}
      </div>
    </div>
  );
}
