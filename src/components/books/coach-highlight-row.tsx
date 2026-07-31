'use client';

import { useState } from 'react';
import { BookOpen, ExternalLink, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorageImage } from '@/components/storage/storage-image';
import { Spinner } from '@/components/ui/spinner';
import { HIGHLIGHT_CATEGORY_LABELS } from '@/lib/books/types';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';

const CATEGORIES: HighlightCategory[] = ['ja', 'my', 'oni', 'system'];

interface CoachHighlightRowProps {
  book: BookWithProfiles;
  onSetHighlight: (bookId: string, category: HighlightCategory, description: string | null, highlighted: boolean) => Promise<boolean>;
  onRemove: (bookId: string) => Promise<boolean>;
}

export function CoachHighlightRow({ book, onSetHighlight, onRemove }: CoachHighlightRowProps) {
  const [category, setCategory] = useState<HighlightCategory>(book.highlight?.category ?? 'ja');
  const [description, setDescription] = useState(book.highlight?.description ?? '');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const run = async (action: string, fn: () => Promise<boolean>) => {
    setBusyAction(action);
    try {
      const ok = await fn();
      if (!ok) setBusyAction(null);
    } catch {
      setBusyAction(null);
    }
  };

  const googleBooksUrl = book.source === 'google_books' && book.external_id
    ? `https://books.google.com/books?id=${book.external_id}`
    : null;
  const openLibraryUrl = book.source === 'open_library' && book.external_id
    ? `https://openlibrary.org${book.external_id}`
    : null;
  const externalUrl = googleBooksUrl ?? openLibraryUrl;

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <div className="shrink-0 w-12 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
        {book.google_books_cover_url ? (
          <StorageImage storageKey={book.google_books_cover_url} alt={book.title_cs} className="w-full h-full object-cover" width={48} height={64} />
        ) : (
          <BookOpen className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <p className="font-medium text-sm">{book.title_cs}</p>
          <p className="text-xs text-muted-foreground">{book.author}</p>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" />
              {googleBooksUrl ? 'Google Books' : 'Open Library'}
            </a>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as HighlightCategory)} disabled={busyAction !== null}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Vyber kategorii" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{HIGHLIGHT_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Popis (volitelné)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Proč je kniha ve výběru?"
              className="text-sm h-8"
              disabled={busyAction !== null}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => run('save', () => onSetHighlight(book.id, category, description.trim() || null, true))}
            disabled={busyAction !== null}
            className="gap-1"
          >
            {busyAction === 'save' ? <Spinner className="size-3" /> : <Save className="size-3" />}
            Uložit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run('unhighlight', () => onSetHighlight(book.id, category, null, false))}
            disabled={busyAction !== null}
            className="gap-1"
          >
            {busyAction === 'unhighlight' ? <Spinner className="size-3" /> : <Sparkles className="size-3" />}
            Odebrat z výběru
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => run('remove', () => onRemove(book.id))}
            disabled={busyAction !== null}
            title="Smazat knihu"
          >
            {busyAction === 'remove' ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        {book.highlight && (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
            {HIGHLIGHT_CATEGORY_LABELS[book.highlight.category]}
          </Badge>
        )}
      </div>
    </div>
  );
}
