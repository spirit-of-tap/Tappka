'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, BookOpen, X } from 'lucide-react';
import { TiptapEditor } from './tiptap-editor';
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
  const [isSaving, setIsSaving] = useState(false);
  const [essayId] = useState<string | null>(initialEssay?.id ?? null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContentChange = useCallback((json: object, text: string) => {
    setContent({ json, text });

    if (!essayId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      await fetch(`/api/essays/${essayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_json: json, content_text: text }),
      });
    }, 5000);
  }, [essayId]);

  const searchBooks = async (q: string) => {
    if (!q.trim()) { setBookResults([]); return; }
    const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
    const { data } = await res.json();
    setBookResults(data ?? []);
  };

  const handlePublish = async () => {
    if (!title.trim() || !content.json) return;
    setIsSaving(true);
    try {
      const method = essayId ? 'PATCH' : 'POST';
      const url = essayId ? `/api/essays/${essayId}` : '/api/essays';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content_json: content.json,
          content_text: content.text,
          book_id: selectedBook?.id ?? null,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data?.id) {
          toast.success('Esej publikována.');
          router.push(`/cteni/eseje/${data.id}`);
        }
      } else {
        toast.error('Nepodařilo se publikovat esej.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="essay-title">Název eseje</Label>
        <Input
          id="essay-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Název eseje..."
          className="text-lg font-medium"
        />
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
              onClick={() => setSelectedBook(null)}
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
                    onClick={() => { setSelectedBook(book); setBookResults([]); setBookQuery(''); }}
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

      <Button onClick={handlePublish} disabled={!title.trim() || isSaving} size="lg">
        {isSaving ? <Spinner className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
        {essayId ? 'Uložit změny' : 'Zveřejnit'}
      </Button>
    </div>
  );
}
