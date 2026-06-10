'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save, BookOpen, X } from 'lucide-react';
import { TiptapEditor } from './tiptap-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import type { Book } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';
import { BOOK_STATUS_COLORS } from '@/lib/books/types';
import { cn } from '@/lib/utils';

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
  const [selectedBook, setSelectedBook] = useState<Book | null>(initialEssay?.book as Book | null ?? null);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [essayId, setEssayId] = useState<string | null>(initialEssay?.id ?? null);

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
      const { data } = await res.json();
      if (data?.id) {
        router.push(`/eseje/${data.id}`);
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
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-sm w-fit', BOOK_STATUS_COLORS[selectedBook.status])}>
            <BookOpen className="size-4" />
            <span>{selectedBook.title}</span>
            <button onClick={() => setSelectedBook(null)}>
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
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    onClick={() => { setSelectedBook(book); setBookResults([]); setBookQuery(''); }}
                  >
                    <span className="font-medium">{book.title}</span>
                    <span className="text-muted-foreground ml-2">{book.author}</span>
                    {book.status === 'approved' && (
                      <Badge variant="secondary" className="ml-2 text-xs">{book.book_points} b.</Badge>
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
