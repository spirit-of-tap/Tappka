'use client';

import { useState } from 'react';
import { BookOpen, ExternalLink, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StorageImage } from '@/components/storage/storage-image';
import { Spinner } from '@/components/ui/spinner';
import { BOOK_STATUS_LABELS } from '@/lib/books/types';
import type { BookListStatus, BookWithProfiles } from '@/lib/books/types';

interface CoachBookRowProps {
  book: BookWithProfiles;
  onClassify: (book: BookWithProfiles, listStatus: BookListStatus, bookPoints: 1 | 2 | 3 | null, reason: string) => Promise<boolean>;
  onRemove: (bookId: string) => Promise<boolean>;
}

export function CoachBookRow({ book, onClassify, onRemove }: CoachBookRowProps) {
  const [points, setPoints] = useState<1 | 2 | 3>(1);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
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

  const classify = (listStatus: BookListStatus, bookPoints: 1 | 2 | 3 | null, reason: string) =>
    run(`classify:${listStatus}`, () => onClassify(book, listStatus, bookPoints, reason));

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
          {book.isbn_13 && <p className="text-xs text-muted-foreground">ISBN: {book.isbn_13}</p>}
          {book.created_by?.name && (
            <p className="text-xs text-muted-foreground mt-1">
              Přidal/a: {book.created_by.name}
            </p>
          )}
          {book.list_status_reason && (
            <p className="text-xs text-muted-foreground mt-1">
              Důvod: {book.list_status_reason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
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

        {!showArchiveForm ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Body:</span>
              {([1, 2, 3] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={points === p ? 'default' : 'outline'}
                  onClick={() => setPoints(p)}
                  className="h-7 w-7 p-0"
                  disabled={busyAction !== null}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={() => classify('shortlist', points, '')}
              disabled={busyAction !== null}
              className="gap-1"
            >
              {busyAction === 'classify:shortlist' ? <Spinner className="size-3" /> : null}
              Do shortlistu
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => classify('longlist', points, '')}
              disabled={busyAction !== null}
              className="gap-1"
            >
              {busyAction === 'classify:longlist' ? <Spinner className="size-3" /> : null}
              Do longlistu
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowArchiveForm(true)}
              disabled={busyAction !== null}
              className="gap-1"
            >
              <Archive className="size-3" />
              Archivovat
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
        ) : (
          <div className="space-y-2">
            <Textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="Důvod archivace..."
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => classify('archived', null, archiveReason)}
                disabled={!archiveReason.trim() || busyAction !== null}
              >
                {busyAction === 'classify:archived' ? <Spinner className="size-3 mr-1" /> : null}
                Archivovat
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowArchiveForm(false); setArchiveReason(''); }}>Zrušit</Button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Badge variant="outline" className="text-xs">{BOOK_STATUS_LABELS[book.list_status]}</Badge>
      </div>
    </div>
  );
}
