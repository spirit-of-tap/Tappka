'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StorageImage } from '@/components/storage/storage-image';
import { Spinner } from '@/components/ui/spinner';
import { BookDescription } from './book-description';
import { DeleteBookDialog } from './delete-book-dialog';
import { RocketBadge, ListStatusBadge } from './book-status-badges';
import type { BookWithProfiles } from '@/lib/books/types';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

interface CoachProcessingRowProps {
  book: BookWithProfiles;
  onApprove: (book: BookWithProfiles, bookPoints: 1 | 2 | 3, reason: string) => Promise<boolean>;
  onReject: (book: BookWithProfiles, reason: string) => Promise<boolean>;
  onDeleted: (bookId: string) => void;
}

export function CoachProcessingRow({
  book,
  onApprove,
  onReject,
  onDeleted,
}: CoachProcessingRowProps) {
  const [points, setPoints] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState(book.list_status_reason ?? '');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canSubmit = reason.trim().length > 0;

  const run = async (action: string, fn: () => Promise<boolean>) => {
    setBusyAction(action);
    try {
      const ok = await fn();
      if (!ok) setBusyAction(null);
    } catch {
      setBusyAction(null);
    }
  };

  const reEnrich = async (): Promise<boolean> => {
    const enrichRes = await fetch('/api/books/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: book.title_cs,
        author: book.author,
        page_count: book.page_count,
      }),
    });
    if (!enrichRes.ok) {
      const { error } = await enrichRes.json();
      toast.error(error ?? 'Nepodařilo se dohledat údaje.');
      return false;
    }
    const { data } = (await enrichRes.json()) as { data: EnrichedBook };

    const patchRes = await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        title: data.title_cs,
        author: data.author,
        description: data.description,
      }),
    });
    if (!patchRes.ok) {
      const { error } = await patchRes.json();
      toast.error(error ?? 'Nepodařilo se uložit dohledané údaje.');
      return false;
    }
    toast.success('Údaje o knize byly dohledány.');
    return true;
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

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/cteni/knihy/${book.id}`}
                className="font-medium text-sm leading-snug hover:underline focus-ring"
              >
                {book.title_cs}
              </Link>
              {book.is_rocket_model && <RocketBadge />}
            </div>
            <p className="text-xs text-muted-foreground">{book.author}</p>
            {book.isbn_13 && <p className="text-xs text-muted-foreground">ISBN: {book.isbn_13}</p>}
            {book.created_by?.name && (
              <p className="text-xs text-muted-foreground mt-1">Navrhuje: {book.created_by.name}</p>
            )}
          </div>
          <ListStatusBadge status={book.list_status} className="shrink-0" />
        </div>

        {book.description && (
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">O knize</p>
            <BookDescription text={book.description} />
          </div>
        )}

        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            {googleBooksUrl ? 'Google Books' : 'Open Library'}
          </a>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`reason-${book.id}`}>
              Důvod ke schválení či zamítnutí
              <span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id={`reason-${book.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Stručně popiš, proč knihu schválíš nebo zamítneš…"
              className="min-h-16"
              maxLength={1000}
            />
          </div>
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
            {book.list_status === 'processing' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => run('re-enrich', reEnrich)}
                disabled={busyAction !== null}
                className="gap-1"
                title="Znovu dohledat údaje o knize (při neúspěchu automatiky)"
              >
                {busyAction === 're-enrich' ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
                Dohledat údaje
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => run('approve', () => onApprove(book, points, reason.trim()))}
              disabled={busyAction !== null || !canSubmit}
              className="gap-1"
            >
              {busyAction === 'approve' ? <Spinner className="size-3" /> : <ThumbsUp className="size-3" />}
              Schválit do longlistu
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => run('reject', () => onReject(book, reason.trim()))}
              disabled={busyAction !== null || !canSubmit}
              className="gap-1"
            >
              {busyAction === 'reject' ? <Spinner className="size-3" /> : <ThumbsDown className="size-3" />}
              Odmítnout
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={busyAction !== null}
              title="Smazat knihu"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <DeleteBookDialog
        book={book}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </div>
  );
}
